package agentmodel

// AICredentials never travels to the browser; only AIStatus is returned.
type AICredentials struct {
	APIKey string `json:"apiKey"`
	Model  string `json:"model"`
}
type AIStatus struct {
	ConfigID   string    `json:"configId"`
	Configured bool      `json:"configured"`
	Model      string    `json:"model"`
	Source     string    `json:"source"`
	Models     []AIModel `json:"models"`
}
type AIUpdate struct {
	ConfigID string `json:"configId"`
}

const DeepSeekModel = "deepseek-flash"

type AIModel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// SupportedModels is the application's supported DeepSeek catalog, not an account quota check.
func SupportedModels() []AIModel {
	return []AIModel{{ID: DeepSeekModel, Name: "DeepSeek Flash"}, {ID: "deepseek-v4-pro", Name: "DeepSeek V4 Pro"}}
}
func SupportedModel(id string) bool {
	for _, v := range SupportedModels() {
		if v.ID == id {
			return true
		}
	}
	return false
}
