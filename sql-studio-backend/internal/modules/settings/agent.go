package settings

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
)

// AgentStatus uses the same ai section as completion and optimization.
func (s *Service) AgentStatus(ctx context.Context) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, "ai")
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	var cfg model.AIConfig
	if doc.Revision > 0 && json.Unmarshal(doc.Data, &cfg) != nil {
		return agentmodel.AIStatus{}, errors.New("AI配置损坏")
	}
	selected := cfg.Model
	if selected == "" {
		selected = agentmodel.DeepSeekModel
	}
	models := agentmodel.SupportedModels()
	if !agentmodel.SupportedModel(selected) {
		models = append(models, agentmodel.AIModel{ID: selected, Name: selected})
	}
	source := "none"
	if cfg.APIKey != "" {
		source = "saved"
	}
	return agentmodel.AIStatus{Configured: cfg.APIKey != "", Model: selected, Source: source, Models: models}, nil
}
func (s *Service) UpdateAgent(ctx context.Context, input agentmodel.AIUpdate) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, "ai")
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	var cfg model.AIConfig
	if doc.Revision > 0 && json.Unmarshal(doc.Data, &cfg) != nil {
		return agentmodel.AIStatus{}, errors.New("AI配置损坏")
	}
	if input.Model != "" && input.Model != cfg.Model && !agentmodel.SupportedModel(input.Model) {
		return agentmodel.AIStatus{}, errors.New("请选择支持的DeepSeek模型")
	}
	cfg.Provider = "deepseek"
	cfg.APIKey = input.APIKey
	if input.Model != "" {
		cfg.Model = input.Model
	}
	if cfg.Model == "" {
		cfg.Model = agentmodel.DeepSeekModel
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	if _, err = s.Write(ctx, "ai", model.StateWrite{Revision: doc.Revision, Data: data}); err != nil {
		return agentmodel.AIStatus{}, err
	}
	return s.AgentStatus(ctx)
}
func (s *Service) ClearAgent(ctx context.Context) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, "ai")
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	if _, err = s.RemoveAI(ctx, doc.Revision); err != nil {
		return agentmodel.AIStatus{}, err
	}
	return s.AgentStatus(ctx)
}
