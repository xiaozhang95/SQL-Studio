package deepseek

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sql-studio-backend/internal/model"
	"time"
)

const endpoint = "https://api.deepseek.com/chat/completions"
const modelsEndpoint = "https://api.deepseek.com/models"
const DefaultModel = "deepseek-flash"

type Client struct {
	http     *http.Client
	endpoint string
}

func New() *Client {
	return &Client{http: &http.Client{Timeout: 32 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}, endpoint: endpoint}
}
func (c *Client) Generate(ctx context.Context, key string, modelID string, messages []model.AIMessage, tokens int) (string, error) {
	if modelID == "" {
		modelID = DefaultModel
	}
	body := struct {
		Model    string            `json:"model"`
		Messages []model.AIMessage `json:"messages"`
		Thinking struct {
			Type string `json:"type"`
		} `json:"thinking"`
		ResponseFormat struct {
			Type string `json:"type"`
		} `json:"response_format"`
		MaxTokens   int     `json:"max_tokens"`
		Temperature float64 `json:"temperature"`
	}{Model: modelID, Messages: messages, MaxTokens: tokens, Temperature: 0.2}
	body.Thinking.Type = "disabled"
	body.ResponseFormat.Type = "json_object"
	data, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(data))
	if err != nil {
		return "", errors.New("AI 请求创建失败")
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", errors.New("DeepSeek 连接失败，请检查网络后重试")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		switch response.StatusCode {
		case 401:
			return "", errors.New("DeepSeek Key 无效，请重新配置")
		case 402:
			return "", errors.New("DeepSeek 余额不足")
		case 429:
			return "", errors.New("DeepSeek 请求频率受限，请稍后重试")
		default:
			return "", fmt.Errorf("DeepSeek 服务请求失败（HTTP %d）", response.StatusCode)
		}
	}
	data, err = io.ReadAll(io.LimitReader(response.Body, 256*1024+1))
	if err != nil || len(data) > 256*1024 {
		return "", errors.New("DeepSeek 响应读取失败或过大")
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Choices) != 1 || result.Choices[0].FinishReason != "stop" {
		return "", errors.New("DeepSeek 响应不完整，请缩短 SQL 后重试")
	}
	return result.Choices[0].Message.Content, nil
}

// Models 保留官方模型 ID 和显示名，不以本地固定列表替代服务端结果。
func (c *Client) Models(ctx context.Context, key string) ([]model.AIModel, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsEndpoint, nil)
	if err != nil {
		return nil, errors.New("模型列表请求创建失败")
	}
	req.Header.Set("Authorization", "Bearer "+key)
	response, err := c.http.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, errors.New("DeepSeek 模型列表连接失败")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		if response.StatusCode == 401 {
			return nil, errors.New("DeepSeek Key 无效，请重新配置")
		}
		return nil, fmt.Errorf("DeepSeek 模型列表获取失败（HTTP %d）", response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 256*1024+1))
	if err != nil || len(data) > 256*1024 {
		return nil, errors.New("模型列表响应读取失败或过大")
	}
	var result struct {
		Data []model.AIModel `json:"data"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Data) == 0 || len(result.Data) > 100 {
		return nil, errors.New("DeepSeek 模型列表无效")
	}
	seen := make(map[string]bool)
	for i, item := range result.Data {
		if item.ID == "" || len(item.ID) > 128 || seen[item.ID] {
			return nil, errors.New("DeepSeek 模型标识无效")
		}
		seen[item.ID] = true
		if item.Name == "" {
			result.Data[i].Name = item.ID
		}
	}
	return result.Data, nil
}
