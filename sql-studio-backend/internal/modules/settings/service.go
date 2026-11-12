package settings

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"sql-studio-backend/internal/model"
)

var ErrConflict = model.ErrStateConflict
var sectionPattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,47}$`)

const MaxBytes = 32 * 1024 * 1024

func ValidSection(name string) bool {
	return sectionPattern.MatchString(name) && name != model.ConnectionsSection && name != "ai"
}

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
	if name == model.AIModelsSection && err == nil {
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
	if name == model.AIModelsSection {
		return s.writeAI(ctx, input)
	}
	return s.repository.Write(ctx, name, input)
}
