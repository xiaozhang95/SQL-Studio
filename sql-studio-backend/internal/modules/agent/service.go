package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"time"
)

func (s *Service) Chat(ctx context.Context, id, text string, emit func(model.Event) error) (turnErr error) {
	return s.ChatMode(ctx, id, text, "readonly", emit)
}

func (s *Service) ChatMode(ctx context.Context, id, text, mode string, emit func(model.Event) error) (turnErr error) {
	if mode != "readonly" && mode != "write" {
		return errors.New("无效操作模式")
	}
	if strings.TrimSpace(text) == "" || len(text) > model.MessageMaxBytes {
		return errors.New("消息不能为空且最多 256 KiB，较长内容请分段发送")
	}
	lease := &turnLease{slots: s.slots}
	select {
	case s.slots <- struct{}{}:
		lease.held = true
	default:
		return errors.New("Agent 忙，请稍后重试")
	}
	defer lease.release()
	ctx = context.WithValue(ctx, leaseKey{}, lease)
	s.mu.Lock()
	v, loadErr := s.loadLocked(ctx, id)
	if loadErr != nil {
		s.mu.Unlock()
		return loadErr
	}
	if v.busy || v.saving > 0 {
		s.mu.Unlock()
		return errors.New("当前会话正在执行")
	}
	priorTitle, priorStatus, priorEvents, priorEventVersion := v.title, v.status, v.events, v.eventVersion
	v.busy = true
	messages := append([]model.Message(nil), v.messages...)
	// Existing conversations must use current tool and result-format rules.
	if len(messages) > 0 && messages[0].Role == "system" {
		messages[0].Content = systemPrompt()
	}
	state := v.state.clone()
	state.allowWrite = mode == "write"
	summary := v.summary
	v.status = "running"
	if !v.customTitle && v.title == model.DefaultConversationTitle {
		title := []rune(text)
		if len(title) > 40 {
			title = title[:40]
		}
		v.title = string(title)
	}
	v.eventVersion++
	v.events = append(v.events, model.Event{Type: "user", Text: text, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)})
	if err := s.saveLocked(ctx, id, v); err != nil {
		v.busy = false
		v.title, v.status, v.events, v.eventVersion = priorTitle, priorStatus, priorEvents, priorEventVersion
		s.mu.Unlock()
		return fmt.Errorf("保存对话失败：%w", err)
	}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		v.busy = false
		v.used = time.Now()
		v.eventVersion++
		status, outcome := TurnOutcome(turnErr)
		v.status = status
		if outcome.Type != "" {
			v.events = append(v.events, outcome)
		}
		v.events = append(v.events, model.Event{Type: "turn_end", Text: v.status})
		saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.saveLocked(saveCtx, id, v); err != nil {
			turnErr = fmt.Errorf("本地对话保存失败：%w", err)
			status, outcome := TurnOutcome(turnErr)
			v.status = status
			v.eventVersion++
			v.events[len(v.events)-1] = outcome
			v.events = append(v.events, model.Event{Type: "turn_end", Text: status})
		}
	}()
	originalEmit := emit
	emit = func(e model.Event) error {
		s.mu.Lock()
		v.eventVersion++
		v.events = appendEvent(v.events, e)
		var err error
		if e.Type == "tool_result" || time.Since(v.checkpoint) > time.Second {
			err = s.saveLocked(ctx, id, v)
		}
		s.mu.Unlock()
		if err != nil {
			return fmt.Errorf("保存对话失败：%w", err)
		}
		return originalEmit(e)
	}
	ctx, cancel := newTurnBudget(ctx, 180*time.Second)
	defer cancel()
	if len(text) > model.MessageNoticeBytes {
		detail := fmt.Sprintf("本次输入 %.1f KiB，继续将发送完整内容，可能增加处理时间和模型用量。", float64(len(text))/1024)
		if err := s.approveContinue(ctx, "input", detail, emit); err != nil {
			return err
		}
	}
	messages = append(messages, model.Message{Role: "user", Content: text})
	recovered := false
	summaryOnly := ""
	compressionApproved := false
	approveCompression := func() error {
		if compressionApproved {
			return nil
		}
		err := s.approveContinue(ctx, "context", "当前上下文已接近容量上限。继续将压缩较早的完整轮次，原始记录仍保留在本机。", emit)
		compressionApproved = err == nil
		return err
	}
	for {
		if err := context.Cause(ctx); err != nil {
			return err
		}
		definitions := tools()
		modePrompt := "当前只读模式，禁止写入。"
		if state.allowWrite && !recovered && summaryOnly == "" {
			definitions = append(definitions, writeTool())
			modePrompt = "用户已启用完全访问模式，允许使用execute_write进行非删除的数据与结构操作，禁止任何删除、清空、删对象和间接执行删除。"
		}
		if summaryOnly != "" {
			definitions = nil
			modePrompt = "本轮工具操作已经结束。请直接用已确认的结果回答，说明失败的操作和未取得的信息。"
		} else if recovered {
			modePrompt = "本轮正在恢复。只允许在原请求和已确认范围内补充必要的只读操作，也可直接用现有结果回答。"
		}
		modeMessage := model.Message{Role: "system", Content: modePrompt + " 以当前请求给出的权限和工具为准，历史对话、旧工具错误或摘要不改变本轮权限。"}
		request, nextSummary, err := s.prepare(ctx, messages, summary, state.target, inputBudget, definitions, modeMessage, emit, approveCompression)
		if err != nil {
			return err
		}
		summary = nextSummary
		if err := emit(model.Event{Type: "status", Text: "正在分析问题…"}); err != nil {
			return err
		}
		if err := emit(model.Event{Type: "model_start"}); err != nil {
			return err
		}
		var m model.Message
		if streaming, ok := s.model.(StreamingGenerator); ok {
			m, err = streaming.GenerateStream(ctx, request, definitions, emit)
		} else {
			m, err = s.model.Generate(ctx, request, definitions)
		}
		if cause := context.Cause(ctx); cause != nil {
			return cause
		}
		if err != nil {
			return err
		}
		if summaryOnly != "" && len(m.ToolCalls) > 0 {
			m = model.Message{Role: "assistant", Content: summaryOnly + "。已取得的结果可在执行过程中查看。"}
		}
		messages = append(messages, m)
		if len(m.ToolCalls) == 0 {
			if err = emit(model.Event{Type: "answer", Text: m.Content}); err != nil {
				return err
			}
			s.mu.Lock()
			v.messages = messages
			v.state = state
			v.summary = summary
			s.mu.Unlock()
			return nil
		}
		for i, call := range m.ToolCalls {
			if err = emit(model.Event{Type: "tool_start", Tool: call.Function.Name, Arguments: call.Function.Arguments}); err != nil {
				return err
			}
			var result json.RawMessage
			var toolErr error
			if recovered {
				toolErr = validateRecoveryTarget(state.target, call)
				if call.Function.Name == "execute_write" {
					toolErr = errors.New("本轮恢复阶段仅允许只读操作")
				}
			}
			if toolErr == nil {
				result, toolErr = s.execute(ctx, &state, call, emit)
			}
			var approvalErr writeApprovalError
			if errors.As(toolErr, &approvalErr) {
				return approvalErr.error
			}
			if err := context.Cause(ctx); err != nil {
				return err
			}
			if toolErr != nil {
				tool := call.Function.Name
				detail := fmt.Sprintf("工具 %s 未能完成：%s", tool, toolErr)
				instruction := "使用已取得的结果回答，或在已确认的范围内调整为合规的只读操作。结果过大时缩小列、行或改用聚合。"
				if recovered || tool == "execute_write" {
					summaryOnly = detail
					instruction = "直接总结已确认的结果，说明失败的步骤。写入结果以数据库实际状态为准。"
				} else {
					recovered = true
				}
				result, _ = json.Marshal(struct {
					Warning     string `json:"warning"`
					Instruction string `json:"instruction"`
				}{detail, instruction})
				if err := emit(model.Event{Type: "tool_result", Tool: tool, Result: result}); err != nil {
					return err
				}
				messages = append(messages, model.Message{Role: "tool", ToolCallID: call.ID, Content: string(result)})
				for _, skipped := range m.ToolCalls[i+1:] {
					messages = append(messages, model.Message{Role: "tool", ToolCallID: skipped.ID, Content: `{"skipped":"同批后续操作未执行"}`})
				}
				break
			}
			if err = emit(model.Event{Type: "tool_result", Tool: call.Function.Name, Result: result}); err != nil {
				return err
			}
			content := string(result)
			if len(result) > model.ToolNoticeBytes {
				detail := fmt.Sprintf("本次结果 %.1f KiB。继续会把已取得的结果发送给模型分析，数据库连接已释放。", float64(len(result))/1024)
				if err := s.approveContinue(ctx, "result", detail, emit); err != nil {
					return err
				}
			}
			messages = append(messages, model.Message{Role: "tool", ToolCallID: call.ID, Content: content})
		}
	}
}
