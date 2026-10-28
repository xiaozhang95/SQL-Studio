package workspace

import (
	"context"
	"encoding/json"
	"errors"
	"regexp"
	"sql-studio-backend/internal/model"
	"sync"
	"time"
)

type Repository interface {
	ReadWorkspace(context.Context) (model.WorkspaceDocument, error)
	CommitWorkspace(context.Context, model.WorkspaceCommit) (model.WorkspaceDocument, error)
	ReadWorkspacePart(context.Context, string) (json.RawMessage, error)
}
type Service struct {
	repository Repository
	mu         sync.Mutex
	collected  time.Time
}

func New(repository Repository) *Service { return &Service{repository: repository} }
func (s *Service) Read(ctx context.Context) (model.WorkspaceDocument, error) {
	return s.repository.ReadWorkspace(ctx)
}

var partID = regexp.MustCompile(`^[a-f0-9]{64}$`)

func (s *Service) Part(ctx context.Context, id string) (json.RawMessage, error) {
	if !partID.MatchString(id) {
		return nil, errors.New("工作区内容标识无效")
	}
	return s.repository.ReadWorkspacePart(ctx, id)
}
func (s *Service) Commit(ctx context.Context, input model.WorkspaceCommit) (model.WorkspaceDocument, error) {
	if input.Index.Version != 2 || input.Index.Tabs == nil || len(input.Index.Tabs) > 10000 {
		return model.WorkspaceDocument{}, errors.New("工作区索引版本或标签无效")
	}
	var explorer map[string]json.RawMessage
	if json.Unmarshal(input.Index.Explorer, &explorer) != nil || explorer == nil {
		return model.WorkspaceDocument{}, errors.New("工作区布局无效")
	}
	for _, views := range []map[string]json.RawMessage{input.Index.ResultViews, input.Index.EditorLayouts} {
		if views == nil {
			return model.WorkspaceDocument{}, errors.New("工作区视图布局缺失")
		}
	}
	ids := map[string]bool{}
	for _, page := range input.Index.Tabs {
		if page.ID == "" || len(page.ID) > 256 || ids[page.ID] {
			return model.WorkspaceDocument{}, errors.New("工作区标签标识无效")
		}
		ids[page.ID] = true
		switch page.Kind {
		case "query", "data", "structure", "ddl", "table-create", "table-design":
		default:
			return model.WorkspaceDocument{}, errors.New("工作区页面类型无效")
		}
		if page.ResultStatus != "" && page.ResultStatus != "success" && page.ResultStatus != "error" {
			return model.WorkspaceDocument{}, errors.New("结果摘要状态无效")
		}
		if len(page.Title) > 4096 || len(page.Database) > 4096 || len(page.Table) > 4096 {
			return model.WorkspaceDocument{}, errors.New("工作区标签名称过长")
		}
	}
	if input.Index.ActiveTab != "" && !ids[input.Index.ActiveTab] {
		return model.WorkspaceDocument{}, errors.New("活动标签不存在")
	}
	if input.Index.RunningTabID != "" && !ids[input.Index.RunningTabID] {
		return model.WorkspaceDocument{}, errors.New("执行标签不存在")
	}
	for id, sql := range input.Drafts {
		if !ids[id] || len(sql) > model.WorkspacePartMaxBytes {
			return model.WorkspaceDocument{}, errors.New("草稿范围或大小无效")
		}
	}
	for id, result := range input.Results {
		var obj map[string]json.RawMessage
		if !ids[id] || len(result) > model.WorkspacePartMaxBytes || (string(result) != "null" && (json.Unmarshal(result, &obj) != nil || obj == nil)) {
			return model.WorkspaceDocument{}, errors.New("结果范围或内容无效")
		}
	}
	doc, err := s.repository.CommitWorkspace(ctx, input)
	if err == nil {
		s.mu.Lock()
		collect := time.Since(s.collected) > 5*time.Second
		if collect {
			s.collected = time.Now()
		}
		s.mu.Unlock()
		if collect {
			if collector, ok := s.repository.(interface{ CollectWorkspaceParts(context.Context) error }); ok {
				_ = collector.CollectWorkspaceParts(ctx)
			}
		}
	}
	return doc, err
}
