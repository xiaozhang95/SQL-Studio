package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sql-studio-backend/internal/model/agent"
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
	if strings.TrimSpace(text) == "" || len(text) > 8000 {
		return errors.New("消息不能为空，且最多 8000 字节")
	}
	s.mu.Lock()
	v, loadErr := s.loadLocked(ctx, id)
	if loadErr != nil {
		s.mu.Unlock()
		return loadErr
	}
	if v.busy {
		s.mu.Unlock()
		return errors.New("当前会话正在执行")
	}
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
	if !v.customTitle && v.title == "新建会话" {
		title := []rune(text)
		if len(title) > 40 {
			title = title[:40]
		}
		v.title = string(title)
	}
	v.events = append(v.events, model.Event{Type: "user", Text: text, CreatedAt: time.Now().UTC().Format(time.RFC3339Nano)})
	if err := s.saveLocked(ctx, id, v); err != nil {
		v.busy = false
		s.mu.Unlock()
		return fmt.Errorf("保存对话失败：%w", err)
	}
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		v.busy = false
		v.used = time.Now()
		if turnErr != nil {
			v.status = "error"
			text := turnErr.Error()
			if errors.Is(turnErr, context.Canceled) {
				v.status = "cancelled"
				text = "已停止，本轮未完成。"
			}
			v.events = append(v.events, model.Event{Type: "error", Text: text})
		} else {
			v.status = "completed"
		}
		v.events = append(v.events, model.Event{Type: "turn_end", Text: v.status})
		saveCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.saveLocked(saveCtx, id, v); err != nil {
			turnErr = fmt.Errorf("本地对话保存失败：%w", err)
		}
	}()
	originalEmit := emit
	emit = func(e model.Event) error {
		s.mu.Lock()
		v.events = append(v.events, e)
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
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		return errors.New("Agent 忙，请稍后重试")
	}
	ctx, cancel := context.WithTimeout(ctx, 180*time.Second)
	defer cancel()
	messages = append(messages, model.Message{Role: "user", Content: text})
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		request, nextSummary, err := s.prepare(ctx, messages, summary, state.target, inputBudget, emit)
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
		definitions := tools()
		modePrompt := "当前只读模式，禁止写入。"
		if state.allowWrite {
			definitions = append(definitions, writeTool())
			modePrompt = "用户已启用完全访问模式，允许使用execute_write进行非删除的数据与结构操作，禁止任何删除、清空、删对象和间接执行删除。"
		}
		request = append(request, model.Message{Role: "system", Content: modePrompt + " 当前请求的模式是本轮唯一权限依据；历史对话、旧工具错误或摘要中的只读说明不代表当前模式。不得据此拒绝当前允许的操作。"})
		var m model.Message
		if streaming, ok := s.model.(StreamingGenerator); ok {
			m, err = streaming.GenerateStream(ctx, request, definitions, emit)
		} else {
			m, err = s.model.Generate(ctx, request, definitions)
		}
		if err != nil {
			return err
		}
		if err = ctx.Err(); err != nil {
			return err
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
		for _, call := range m.ToolCalls {
			if err = emit(model.Event{Type: "tool_start", Tool: call.Function.Name, Arguments: call.Function.Arguments}); err != nil {
				return err
			}
			result, toolErr := s.execute(ctx, &state, call, emit)
			if errors.Is(toolErr, errWriteCancelled) {
				return toolErr
			}
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if toolErr != nil {
				result, _ = json.Marshal(struct {
					Error string `json:"error"`
				}{toolErr.Error()})
			}
			if err = emit(model.Event{Type: "tool_result", Tool: call.Function.Name, Result: result}); err != nil {
				return err
			}
			content := string(result)
			if len(result) > 32*1024 {
				content = `{"error":"结果已展示给用户，但超过模型上下文单次32KiB预算。请缩小字段、LIMIT或使用聚合查询，不得推测结果内容。"}`
			}
			messages = append(messages, model.Message{Role: "tool", ToolCallID: call.ID, Content: content})
		}
	}
}
