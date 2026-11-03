package model

import (
	"errors"
	"time"
)

var ErrConflict = errors.New("记录已被其他请求更新，请重新加载")

type TokenUsage struct {
	Prompt     int `json:"promptTokens"`
	Completion int `json:"completionTokens"`
	Estimated  int `json:"estimatedTokens,omitempty"`
	Window     int `json:"window"`
}
type ContextSummary struct {
	Through int    `json:"through"`
	Text    string `json:"text"`
}
type DiscoveryState struct {
	Target      Target              `json:"target"`
	Connections []Connection        `json:"connections"`
	Databases   map[string][]string `json:"databases"`
}
type Conversation struct {
	ID          string         `json:"id"`
	Revision    uint64         `json:"revision"`
	Title       string         `json:"title"`
	CustomTitle bool           `json:"customTitle,omitempty"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	Status      string         `json:"status"`
	Messages    []Message      `json:"messages"`
	Events      []Event        `json:"events"`
	State       DiscoveryState `json:"state"`
	Summary     ContextSummary `json:"summary"`
}
type ConversationInfo struct {
	ID        string    `json:"id"`
	Revision  uint64    `json:"revision"`
	Title     string    `json:"title"`
	UpdatedAt time.Time `json:"updatedAt"`
	Status    string    `json:"status"`
}
type ConversationView struct {
	ConversationInfo
	Events []Event `json:"events"`
	Busy   bool    `json:"busy"`
}
type Layout struct {
	ActiveID string   `json:"activeId"`
	Draft    string   `json:"draft"`
	Expanded []string `json:"expanded"`
}
type Workspace struct {
	SchemaVersion int       `json:"schemaVersion"`
	Revision      uint64    `json:"revision"`
	UpdatedAt     time.Time `json:"updatedAt"`
	State         Layout    `json:"state"`
}
