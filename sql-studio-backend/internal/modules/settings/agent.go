package settings

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
)

// Agent uses only models explicitly added to the shared ai configuration list.
func (s *Service) AgentStatus(ctx context.Context) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, model.AIModelsSection)
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	var cfg model.AIConfig
	if doc.Revision > 0 && json.Unmarshal(doc.Data, &cfg) != nil {
		return agentmodel.AIStatus{}, errors.New("AI配置损坏")
	}
	models := []agentmodel.AIModel{}
	for _, entry := range cfg.Configurations {
		if entry.Model != "" && entry.APIKey != "" {
			models = append(models, agentmodel.AIModel{ID: entry.ID, Name: entry.ModelName})
		}
	}
	selected, configured := cfg.SelectedConfiguration()
	source := "none"
	if configured {
		source = "saved"
	}
	return agentmodel.AIStatus{ConfigID: selected.ID, Configured: configured, Model: selected.Model, Source: source, Models: models}, nil
}
func (s *Service) UpdateAgent(ctx context.Context, input agentmodel.AIUpdate) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, model.AIModelsSection)
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	var cfg model.AIConfig
	if doc.Revision > 0 && json.Unmarshal(doc.Data, &cfg) != nil {
		return agentmodel.AIStatus{}, errors.New("AI配置损坏")
	}
	selected := input.ConfigID
	if selected == "" {
		return agentmodel.AIStatus{}, errors.New("请选择已经添加的模型")
	}
	found := false
	for i := range cfg.Configurations {
		entry := &cfg.Configurations[i]
		if selected != "" && entry.ID == selected {
			cfg.ActiveID = entry.ID
			found = true
			break
		}
	}
	if !found {
		return agentmodel.AIStatus{}, errors.New("只能选择已经添加的模型，请先到系统设置中添加")
	}
	data, err := json.Marshal(cfg)
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	if _, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: data}); err != nil {
		return agentmodel.AIStatus{}, err
	}
	return s.AgentStatus(ctx)
}
func (s *Service) ClearAgent(ctx context.Context) (agentmodel.AIStatus, error) {
	doc, err := s.repository.Read(ctx, model.AIModelsSection)
	if err != nil {
		return agentmodel.AIStatus{}, err
	}
	if _, err = s.RemoveAI(ctx, doc.Revision); err != nil {
		return agentmodel.AIStatus{}, err
	}
	return s.AgentStatus(ctx)
}
