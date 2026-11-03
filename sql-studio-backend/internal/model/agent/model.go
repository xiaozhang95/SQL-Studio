package model

import "encoding/json"

type Connection struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}
type Target struct {
	ConnectionID string `json:"connectionId"`
	Database     string `json:"database"`
}
type Function struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}
type ToolCall struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"`
	Function Function `json:"function"`
}
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	Reasoning  string     `json:"reasoning_content,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}
type Tool struct {
	Type     string         `json:"type"`
	Function ToolDefinition `json:"function"`
}
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}
type Event struct {
	CreatedAt string          `json:"createdAt,omitempty"`
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	Tool      string          `json:"tool,omitempty"`
	Arguments string          `json:"arguments,omitempty"`
	Result    json.RawMessage `json:"result,omitempty"`
	Usage     *TokenUsage     `json:"usage,omitempty"`
}
