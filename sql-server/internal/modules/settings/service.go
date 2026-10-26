package settings

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"sql-studio/internal/model"
	"strings"
)

var ErrConflict = model.ErrStateConflict
var modelPattern = regexp.MustCompile(`^[a-zA-Z0-9._-]+$`)
var sectionPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,47}$`)

const MaxBytes = 32 * 1024 * 1024

func ValidSection(name string) bool { return sectionPattern.MatchString(name) }

type Repository interface {
	Read(context.Context, string) (model.StateDocument, error)
	Write(context.Context, string, model.StateWrite) (model.StateDocument, error)
}
type Service struct{ repository Repository }

func New(repository Repository) *Service { return &Service{repository: repository} }
func (s *Service) Read(ctx context.Context, name string) (model.StateDocument, error) {
	if !ValidSection(name) {
		return model.StateDocument{}, errors.New("配置分区名称无效")
	}
	doc, err := s.repository.Read(ctx, name)
	if name == "ai" && err == nil {
		return publicAI(doc)
	}
	return doc, err
}
func (s *Service) Write(ctx context.Context, name string, input model.StateWrite) (model.StateDocument, error) {
	if !ValidSection(name) || len(input.Data) > MaxBytes {
		return model.StateDocument{}, errors.New("配置分区或大小无效")
	}
	var value map[string]json.RawMessage
	if json.Unmarshal(input.Data, &value) != nil || value == nil {
		return model.StateDocument{}, errors.New("配置数据必须是 JSON 对象")
	}
	if name == "ai" {
		var config model.AIConfig
		if json.Unmarshal(input.Data, &config) != nil || config.Provider != "deepseek" {
			return model.StateDocument{}, errors.New("AI 模型配置无效")
		}
		old, err := s.repository.Read(ctx, name)
		if err != nil {
			return model.StateDocument{}, err
		}
		var previous model.AIConfig
		if old.Revision > 0 && json.Unmarshal(old.Data, &previous) != nil {
			return model.StateDocument{}, errors.New("AI 配置损坏")
		}
		if config.Model == "" {
			config.Model = previous.Model
		}
		if len(config.Model) > 128 || (config.Model != "" && !modelPattern.MatchString(config.Model)) {
			return model.StateDocument{}, errors.New("AI 模型标识无效")
		}
		if config.CompletionEnabled == nil {
			config.CompletionEnabled = previous.CompletionEnabled
		}
		if config.CompletionEnabled == nil {
			enabled := true
			config.CompletionEnabled = &enabled
		}
		config.APIKey = strings.TrimSpace(config.APIKey)
		if len(config.APIKey) > 512 {
			return model.StateDocument{}, errors.New("API Key 过长")
		}
		if config.APIKey == "" {
			config.APIKey = previous.APIKey
		}
		if config.APIKey == "" {
			return model.StateDocument{}, errors.New("请输入 API Key")
		}
		config.Configured = false
		input.Data, _ = json.Marshal(config)
		doc, err := s.repository.Write(ctx, name, input)
		if err != nil {
			return model.StateDocument{}, err
		}
		return publicAI(doc)
	}
	return s.repository.Write(ctx, name, input)
}

func publicAI(doc model.StateDocument) (model.StateDocument, error) {
	if doc.Revision == 0 {
		return doc, nil
	}
	var config model.AIConfig
	if json.Unmarshal(doc.Data, &config) != nil {
		return model.StateDocument{}, errors.New("AI 配置损坏")
	}
	if config.CompletionEnabled == nil {
		enabled := true
		config.CompletionEnabled = &enabled
	}
	config.Configured = config.APIKey != ""
	config.APIKey = ""
	doc.Data, _ = json.Marshal(config)
	return doc, nil
}

// RemoveAI 清空配置内容但保留修订号，避免旧窗口重新写回已移除的密钥。
func (s *Service) RemoveAI(ctx context.Context, revision uint64) (model.StateDocument, error) {
	enabled := false
	data, _ := json.Marshal(model.AIConfig{Provider: "deepseek", CompletionEnabled: &enabled})
	doc, err := s.repository.Write(ctx, "ai", model.StateWrite{Revision: revision, Data: data})
	if err != nil {
		return model.StateDocument{}, err
	}
	return publicAI(doc)
}
