package model

// AIRequest 不包含数据库凭据或查询结果；结构由当前页面缓存提供。
type AIRequest struct {
	Schema       string               `json:"schema,omitempty"`
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

// AIModelsSection isolates the new list format from obsolete single-model files.
const AIModelsSection = "ai-models"

// AIConfig 仅后端保存 APIKey，公开响应清除 APIKey。
type AIConfig struct {
	Configurations    []AIConfiguration `json:"configurations"`
	ActiveID          string            `json:"activeId"`
	CompletionEnabled *bool             `json:"completionEnabled,omitempty"`
}

// AIConfiguration identifies one saved credential/model pair; repeated providers are allowed.
type AIConfiguration struct {
	ID         string `json:"id"`
	Provider   string `json:"provider"`
	Model      string `json:"model"`
	ModelName  string `json:"modelName"`
	APIKey     string `json:"apiKey,omitempty"`
	Configured bool   `json:"configured,omitempty"`
}

// SelectedConfiguration uses the first usable saved model when no default has been set.
func (c AIConfig) SelectedConfiguration() (AIConfiguration, bool) {
	for _, entry := range c.Configurations {
		if entry.ID != "" && entry.Model != "" && entry.APIKey != "" && (c.ActiveID == "" || entry.ID == c.ActiveID) {
			return entry, true
		}
	}
	return AIConfiguration{}, false
}

type AIModel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type AIModelsRequest struct {
	ConfigID string `json:"configId,omitempty"`
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey,omitempty"`
}
