package agentlayout

import (
	"context"
	"errors"
	"regexp"
	model "sql-studio-backend/internal/model/agent"
)

type Repository interface {
	ReadWorkspace(context.Context) (model.Workspace, error)
	WriteWorkspace(context.Context, model.Workspace) (model.Workspace, error)
}
type Service struct{ repo Repository }

func New(repo Repository) *Service { return &Service{repo} }
func (s *Service) Read(ctx context.Context) (model.Workspace, error) {
	return s.repo.ReadWorkspace(ctx)
}

var id = regexp.MustCompile(`^[a-f0-9]{48}$`)

func (s *Service) Save(ctx context.Context, revision uint64, state model.Layout) (model.Workspace, error) {
	if state.Mode != "readonly" && state.Mode != "write" {
		return model.Workspace{}, errors.New("操作模式无效")
	}
	if state.Expanded == nil || (state.ActiveID != "" && !id.MatchString(state.ActiveID)) || len(state.Draft) > model.MessageMaxBytes || len(state.Expanded) > 1024 {
		return model.Workspace{}, errors.New("布局范围或草稿超限")
	}
	for _, key := range state.Expanded {
		if len(key) > 100 {
			return model.Workspace{}, errors.New("展开状态无效")
		}
	}
	return s.repo.WriteWorkspace(ctx, model.Workspace{Revision: revision, State: state})
}
