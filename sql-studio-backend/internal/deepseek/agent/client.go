package agentstream

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	model "sql-studio-backend/internal/model/agent"
	"time"
)

type Credentials interface {
	Credentials(context.Context) (model.AICredentials, error)
}
type Client struct {
	settings Credentials
	endpoint string
	http     *http.Client
}

func New(settings Credentials) *Client {
	return &Client{settings: settings, endpoint: "https://api.deepseek.com/chat/completions", http: &http.Client{Timeout: 60 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (c *Client) Generate(ctx context.Context, messages []model.Message, tools []model.Tool) (model.Message, error) {
	var zero model.Message
	config, configErr := c.settings.Credentials(ctx)
	if configErr != nil {
		return zero, configErr
	}
	if config.APIKey == "" || config.Model == "" {
		return zero, errors.New("请先在系统设置中添加并选择模型")
	}
	body, err := json.Marshal(struct {
		Model     string          `json:"model"`
		Messages  []model.Message `json:"messages"`
		Tools     []model.Tool    `json:"tools,omitempty"`
		MaxTokens int             `json:"max_tokens"`
		Thinking  struct {
			Type string `json:"type"`
		} `json:"thinking"`
	}{config.Model, messages, tools, model.SummaryMaxTokens, struct {
		Type string `json:"type"`
	}{"disabled"}})
	if err != nil {
		return zero, err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.endpoint, bytes.NewReader(body))
	if err != nil {
		return zero, err
	}
	req.Header.Set("Authorization", "Bearer "+config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return zero, ctx.Err()
		}
		return zero, errors.New("DeepSeek 请求失败或超时")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return zero, fmt.Errorf("DeepSeek 返回 %d，请检查 Key、模型和额度", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, 512*1024+1))
	if err != nil || len(data) > 512*1024 {
		return zero, errors.New("DeepSeek 响应过大或读取失败")
	}
	var out struct {
		Choices []struct {
			Message      model.Message `json:"message"`
			FinishReason string        `json:"finish_reason"`
		} `json:"choices"`
	}
	if json.Unmarshal(data, &out) != nil || len(out.Choices) != 1 {
		return zero, errors.New("DeepSeek 响应格式无效")
	}
	choice := out.Choices[0]
	return validate(choice.Message, choice.FinishReason)
}
func validate(m model.Message, finish string) (model.Message, error) {
	var zero model.Message
	if m.Role != "assistant" {
		return zero, errors.New("DeepSeek 消息角色无效")
	}
	if len(m.ToolCalls) > 0 {
		if finish != "tool_calls" {
			return zero, errors.New("工具调用未完整生成")
		}
		seen := map[string]bool{}
		for _, call := range m.ToolCalls {
			if call.ID == "" || seen[call.ID] || call.Type != "function" {
				return zero, errors.New("工具调用标识无效")
			}
			seen[call.ID] = true
		}
	} else if finish != "stop" || m.Content == "" {
		return zero, errors.New("模型回复未完整生成，请缩小问题范围")
	}
	return m, nil
}
