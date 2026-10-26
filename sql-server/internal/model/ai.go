package model

// AIRequest 不包含数据库凭据或查询结果；结构由当前页面缓存提供。
type AIRequest struct {
	Action       string               `json:"action"`
	ConnectionID string               `json:"connectionId"`
	Table        string               `json:"table,omitempty"`
	Document     string               `json:"document,omitempty"`
	Connection   *AIConnectionContext `json:"connection,omitempty"`
	Database     string               `json:"database"`
	SQL          string               `json:"sql"`
	Prefix       string               `json:"prefix"`
	Suffix       string               `json:"suffix"`
	Tables       []AITable            `json:"tables"`
}
type AIConnectionContext struct {
	Name string `json:"name"`
	Type string `json:"type"`
}
type AITable struct {
	Comment string   `json:"comment,omitempty"`
	Name    string   `json:"name"`
	Columns []string `json:"columns"`
}
type AIResult struct {
	Completion  string `json:"completion,omitempty"`
	SQL         string `json:"sql,omitempty"`
	Explanation string `json:"explanation,omitempty"`
}
type AIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AIConfig 仅后端保存 APIKey，公开响应清除 APIKey。
type AIConfig struct {
	Provider          string `json:"provider"`
	Model             string `json:"model,omitempty"`
	APIKey            string `json:"apiKey,omitempty"`
	Configured        bool   `json:"configured,omitempty"`
	CompletionEnabled *bool  `json:"completionEnabled,omitempty"`
}
type AIModel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type AIModelsRequest struct {
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey,omitempty"`
}
