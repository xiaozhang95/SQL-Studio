package settings

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"sql-studio-backend/internal/model"
	"strings"
)

var modelPattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
var configurationIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)

const maxAIConfigurations = 64

func decodeAI(data []byte) (model.AIConfig, error) {
	var config model.AIConfig
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&config) != nil || config.Configurations == nil {
		return model.AIConfig{}, errors.New("模型配置格式无效，请使用新的模型列表格式")
	}
	return config, nil
}

func (s *Service) writeAI(ctx context.Context, input model.StateWrite) (model.StateDocument, error) {
	config, err := decodeAI(input.Data)
	if err != nil {
		return model.StateDocument{}, err
	}
	old, err := s.repository.Read(ctx, model.AIModelsSection)
	if err != nil {
		return model.StateDocument{}, err
	}
	if old.Revision != input.Revision {
		return model.StateDocument{}, ErrConflict
	}
	previous := model.AIConfig{Configurations: []model.AIConfiguration{}}
	if old.Revision > 0 {
		previous, err = decodeAI(old.Data)
		if err != nil {
			return model.StateDocument{}, err
		}
	}
	if len(config.Configurations) > maxAIConfigurations {
		return model.StateDocument{}, errors.New("最多保存 64 条模型配置")
	}
	if config.CompletionEnabled == nil {
		config.CompletionEnabled = previous.CompletionEnabled
	}
	if config.CompletionEnabled == nil {
		enabled := true
		config.CompletionEnabled = &enabled
	}
	ids, pairs := make(map[string]bool), make(map[string]bool)
	activeFound := config.ActiveID == ""
	for i := range config.Configurations {
		entry := &config.Configurations[i]
		if !configurationIDPattern.MatchString(entry.ID) || ids[entry.ID] || entry.Provider != "deepseek" {
			return model.StateDocument{}, errors.New("模型配置 ID 重复或供应商无效")
		}
		ids[entry.ID] = true
		pair := entry.Provider + "\x00" + entry.Model
		if entry.Model == "" || len(entry.Model) > 128 || !modelPattern.MatchString(entry.Model) || pairs[pair] {
			return model.StateDocument{}, errors.New("模型必须明确选择，同一供应商的同一模型不可重复")
		}
		pairs[pair] = true
		if strings.TrimSpace(entry.ModelName) == "" || len(entry.ModelName) > 256 {
			return model.StateDocument{}, errors.New("模型名称无效")
		}
		entry.APIKey = strings.TrimSpace(entry.APIKey)
		if entry.APIKey == "" {
			for _, saved := range previous.Configurations {
				if saved.ID == entry.ID && saved.Provider == entry.Provider {
					entry.APIKey = saved.APIKey
					break
				}
			}
		}
		if entry.APIKey == "" || len(entry.APIKey) > 512 {
			return model.StateDocument{}, errors.New("请填写有效的 API Key")
		}
		entry.Configured = false
		if entry.ID == config.ActiveID {
			activeFound = true
		}
	}
	if !activeFound {
		return model.StateDocument{}, errors.New("使用中的模型记录不存在")
	}
	if len(config.Configurations) == 0 {
		enabled := false
		config.CompletionEnabled = &enabled
	}
	input.Data, err = json.Marshal(config)
	if err != nil {
		return model.StateDocument{}, err
	}
	doc, err := s.repository.Write(ctx, model.AIModelsSection, input)
	if err != nil {
		return model.StateDocument{}, err
	}
	return publicAI(doc)
}

func publicAI(doc model.StateDocument) (model.StateDocument, error) {
	if doc.Revision == 0 {
		return doc, nil
	}
	config, err := decodeAI(doc.Data)
	if err != nil {
		return model.StateDocument{}, err
	}
	if config.CompletionEnabled == nil {
		enabled := true
		config.CompletionEnabled = &enabled
	}
	for i := range config.Configurations {
		config.Configurations[i].Configured = config.Configurations[i].APIKey != ""
		config.Configurations[i].APIKey = ""
	}
	doc.Data, err = json.Marshal(config)
	return doc, err
}

func (s *Service) RemoveAI(ctx context.Context, revision uint64) (model.StateDocument, error) {
	enabled := false
	data, _ := json.Marshal(model.AIConfig{Configurations: []model.AIConfiguration{}, CompletionEnabled: &enabled})
	doc, err := s.repository.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: revision, Data: data})
	if err != nil {
		return model.StateDocument{}, err
	}
	return publicAI(doc)
}
