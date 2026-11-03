package deepseek

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sql-studio-backend/internal/model/agent"
	"strings"
	"time"
)

type streamChoice struct {
	Delta struct {
		Role      string `json:"role"`
		Content   string `json:"content"`
		Reasoning string `json:"reasoning_content"`
		Calls     []struct {
			Index    int            `json:"index"`
			ID       string         `json:"id"`
			Type     string         `json:"type"`
			Function model.Function `json:"function"`
		} `json:"tool_calls"`
	} `json:"delta"`
	Finish string `json:"finish_reason"`
}
type streamChunk struct {
	Choices []streamChoice `json:"choices"`
	Usage   *struct {
		Prompt     int `json:"prompt_tokens"`
		Completion int `json:"completion_tokens"`
	} `json:"usage"`
}

func (c *Client) GenerateStream(ctx context.Context, messages []model.Message, tools []model.Tool, emit func(model.Event) error) (model.Message, error) {
	var zero model.Message
	config, configErr := c.settings.Credentials(ctx)
	if configErr != nil {
		return zero, configErr
	}
	if config.APIKey == "" {
		return zero, errors.New("请在DeepSeek设置中配置API Key")
	}
	body, err := json.Marshal(struct {
		Model     string          `json:"model"`
		Messages  []model.Message `json:"messages"`
		Tools     []model.Tool    `json:"tools"`
		Stream    bool            `json:"stream"`
		MaxTokens int             `json:"max_tokens"`
		Thinking  struct {
			Type string `json:"type"`
		} `json:"thinking"`
		Effort string `json:"reasoning_effort"`
	}{config.Model, messages, tools, true, 16384, struct {
		Type string `json:"type"`
	}{"enabled"}, "low"})
	if err != nil {
		return zero, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
	if err != nil {
		return zero, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)
	httpClient := *c.http
	httpClient.Timeout = 150 * time.Second
	res, err := httpClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return zero, ctx.Err()
		}
		return zero, errors.New("DeepSeek流请求失败或超时")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return zero, fmt.Errorf("DeepSeek返回%d，请检查Key与额度", res.StatusCode)
	}
	return parseStream(ctx, res.Body, emit)
}
func parseStream(ctx context.Context, reader io.Reader, emit func(model.Event) error) (model.Message, error) {
	m := model.Message{Role: "assistant"}
	scanner := bufio.NewScanner(io.LimitReader(reader, 2*1024*1024+1))
	scanner.Buffer(make([]byte, 4096), 256*1024)
	finish := ""
	done := false
	total := 0
	for scanner.Scan() {
		if err := ctx.Err(); err != nil {
			return model.Message{}, err
		}
		line := scanner.Text()
		total += len(line) + 1
		if total > 2*1024*1024 {
			return model.Message{}, errors.New("DeepSeek流超过大小限制")
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			done = true
			break
		}
		var chunk streamChunk
		if json.Unmarshal([]byte(data), &chunk) != nil {
			return model.Message{}, errors.New("DeepSeek流事件格式无效")
		}
		if len(chunk.Choices) > 1 {
			return model.Message{}, errors.New("DeepSeek流包含多个候选")
		}
		if chunk.Usage != nil {
			if err := emit(model.Event{Type: "usage", Usage: &model.TokenUsage{Prompt: chunk.Usage.Prompt, Completion: chunk.Usage.Completion, Window: 1_000_000}}); err != nil {
				return model.Message{}, err
			}
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		choice := chunk.Choices[0]
		d := choice.Delta
		if d.Role != "" && d.Role != "assistant" {
			return model.Message{}, errors.New("DeepSeek流角色无效")
		}
		if d.Reasoning != "" {
			m.Reasoning += d.Reasoning
			if err := emit(model.Event{Type: "reasoning_delta", Text: d.Reasoning}); err != nil {
				return model.Message{}, err
			}
		}
		if d.Content != "" {
			m.Content += d.Content
			if err := emit(model.Event{Type: "answer_delta", Text: d.Content}); err != nil {
				return model.Message{}, err
			}
		}
		for _, part := range d.Calls {
			if part.Index < 0 {
				return model.Message{}, errors.New("工具调用索引无效")
			}
			if part.Index > len(m.ToolCalls) {
				return model.Message{}, errors.New("工具片段顺序无效")
			}
			if part.Index == len(m.ToolCalls) {
				m.ToolCalls = append(m.ToolCalls, model.ToolCall{})
			}
			call := &m.ToolCalls[part.Index]
			if part.ID != "" {
				if call.ID != "" && call.ID != part.ID {
					return model.Message{}, errors.New("工具标识片段不一致")
				}
				call.ID = part.ID
			}
			if part.Type != "" {
				call.Type = part.Type
			}
			call.Function.Name += part.Function.Name
			call.Function.Arguments += part.Function.Arguments
			if len(call.Function.Name) > 100 || len(call.Function.Arguments) > 20000 {
				return model.Message{}, errors.New("工具参数超限")
			}
		}
		if choice.Finish != "" {
			finish = choice.Finish
		}
	}
	if ctx.Err() != nil {
		return model.Message{}, ctx.Err()
	}
	if err := scanner.Err(); err != nil {
		return model.Message{}, errors.New("DeepSeek流读取失败或中断")
	}
	if !done {
		return model.Message{}, errors.New("DeepSeek流中断，本轮未完成")
	}
	return validate(m, finish)
}
