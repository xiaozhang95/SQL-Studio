package statefile

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"sql-studio-backend/internal/model"
	"time"
)

var workspacePartID = regexp.MustCompile(`^[a-f0-9]{64}$`)

func (s *Store) readWorkspace() (model.WorkspaceDocument, error) {
	doc, err := s.read(model.WorkspaceIndexSection)
	if err != nil {
		return model.WorkspaceDocument{}, err
	}
	var index model.WorkspaceIndex
	if doc.Revision == 0 {
		return model.WorkspaceDocument{}, nil
	}
	if json.Unmarshal(doc.Data, &index) != nil || index.Version != 2 || index.Tabs == nil {
		return model.WorkspaceDocument{}, errors.New("工作区索引损坏，原文件已保留")
	}
	return model.WorkspaceDocument{Revision: doc.Revision, Index: index}, nil
}
func (s *Store) ReadWorkspace(ctx context.Context) (model.WorkspaceDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return model.WorkspaceDocument{}, err
	}
	doc, err := s.readWorkspace()
	if err != nil || doc.Revision != 0 {
		return doc, err
	}
	return s.migrateWorkspace(ctx)
}
func (s *Store) part(ctx context.Context, data json.RawMessage) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if len(data) > model.WorkspacePartMaxBytes {
		return "", errors.New("工作区内容超过32MiB")
	}
	hash := sha256.Sum256(data)
	id := hex.EncodeToString(hash[:])
	directory := filepath.Join(s.directory, "workspace-parts")
	if err := os.MkdirAll(directory, 0700); err != nil {
		return "", err
	}
	target := filepath.Join(directory, id+".json")
	if existing, err := os.ReadFile(target); err == nil {
		if sha256.Sum256(existing) != hash {
			return "", errors.New("工作区内容校验失败")
		}
		return id, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	tmp, err := os.CreateTemp(directory, ".part-*.tmp")
	if err != nil {
		return "", directoryError(directory, err)
	}
	defer os.Remove(tmp.Name())
	if err = tmp.Chmod(0600); err == nil {
		_, err = tmp.Write(data)
	}
	if err == nil {
		err = tmp.Sync()
	}
	closeErr := tmp.Close()
	if err == nil {
		err = closeErr
	}
	if err != nil {
		return "", directoryError(directory, err)
	}
	if err = ctx.Err(); err != nil {
		return "", err
	}
	if err = os.Rename(tmp.Name(), target); err != nil {
		return "", directoryError(directory, err)
	}
	return id, nil
}
func (s *Store) ReadWorkspacePart(ctx context.Context, id string) (json.RawMessage, error) {
	if !workspacePartID.MatchString(id) {
		return nil, errors.New("工作区内容标识无效")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	file, err := os.Open(filepath.Join(s.directory, "workspace-parts", id+".json"))
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if info.Size() > model.WorkspacePartMaxBytes {
		return nil, errors.New("工作区内容过大")
	}
	data, err := io.ReadAll(io.LimitReader(file, model.WorkspacePartMaxBytes+1))
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256(data)
	if len(data) > model.WorkspacePartMaxBytes || hex.EncodeToString(sum[:]) != id || !json.Valid(data) {
		return nil, errors.New("工作区内容损坏，原文件已保留")
	}
	return data, ctx.Err()
}
func (s *Store) CommitWorkspace(ctx context.Context, input model.WorkspaceCommit) (model.WorkspaceDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	input.Index.Tabs = append([]model.WorkspacePage{}, input.Index.Tabs...)
	old, err := s.readWorkspace()
	if err != nil {
		return old, err
	}
	if old.Revision != input.Revision {
		return old, model.ErrStateConflict
	}
	previous := map[string]model.WorkspacePage{}
	for _, page := range old.Index.Tabs {
		previous[page.ID] = page
	}
	for i := range input.Index.Tabs {
		page := &input.Index.Tabs[i]
		prior := previous[page.ID]
		if page.DraftRef != prior.DraftRef || page.ResultRef != prior.ResultRef {
			return old, errors.New("工作区内容引用已变化，请刷新后重试")
		}
		if sql, ok := input.Drafts[page.ID]; ok {
			data, _ := json.Marshal(struct {
				SQL string `json:"sql"`
			}{sql})
			page.DraftRef, err = s.part(ctx, data)
			if err != nil {
				return old, err
			}
		} else if page.DraftRef == "" {
			return old, errors.New("新页面缺少草稿")
		}
		if data, ok := input.Results[page.ID]; ok {
			if string(data) == "null" {
				page.ResultRef = ""
			} else {
				page.ResultRef, err = s.part(ctx, data)
				if err != nil {
					return old, err
				}
			}
		}
	}
	return s.commitIndex(ctx, input.Index, old.Revision)
}
func (s *Store) commitIndex(ctx context.Context, index model.WorkspaceIndex, revision uint64) (model.WorkspaceDocument, error) {
	data, err := json.Marshal(index)
	if err != nil {
		return model.WorkspaceDocument{}, err
	}
	doc, err := s.write(ctx, model.WorkspaceIndexSection, model.StateWrite{Revision: revision, Data: data})
	if err != nil {
		return model.WorkspaceDocument{}, err
	}
	return model.WorkspaceDocument{Revision: doc.Revision, Index: index}, nil
}

// One-time migration stays on the server. The old workspace.json is never rewritten.
func (s *Store) migrateWorkspace(ctx context.Context) (model.WorkspaceDocument, error) {
	legacy, err := s.read("workspace")
	if err != nil {
		return model.WorkspaceDocument{}, err
	}
	index := model.WorkspaceIndex{Version: 2, Tabs: []model.WorkspacePage{}, ResultViews: map[string]json.RawMessage{}, EditorLayouts: map[string]json.RawMessage{}, Explorer: json.RawMessage(`{"expanded":[],"selected":[],"search":"","top":0}`), ResultHeight: 260, OpenedConnections: []string{}}
	if legacy.Revision != 0 {
		var saved struct {
			model.WorkspaceIndex
			Tabs []struct {
				model.WorkspacePage
				SQL *string `json:"sql"`
			} `json:"tabs"`
			Runs map[string]json.RawMessage `json:"runs"`
		}
		if json.Unmarshal(legacy.Data, &saved) != nil || saved.Version != 1 || saved.Tabs == nil || saved.Runs == nil {
			return model.WorkspaceDocument{}, errors.New("旧工作区格式无效，未迁移或覆盖")
		}
		index = saved.WorkspaceIndex
		index.Version = 2
		index.Tabs = []model.WorkspacePage{}
		seen := map[string]bool{}
		for _, tab := range saved.Tabs {
			if tab.SQL == nil || tab.ID == "" || seen[tab.ID] {
				return model.WorkspaceDocument{}, errors.New("旧工作区草稿或标签无效，原文件已保留")
			}
			seen[tab.ID] = true
			switch tab.Kind {
			case "query", "data", "structure", "ddl", "table-create", "table-design":
			default:
				return model.WorkspaceDocument{}, errors.New("旧工作区页面类型无效")
			}

			data, _ := json.Marshal(struct {
				SQL string `json:"sql"`
			}{*tab.SQL})
			tab.DraftRef, err = s.part(ctx, data)
			if err != nil {
				return model.WorkspaceDocument{}, err
			}
			if result := saved.Runs[tab.ID]; len(result) > 0 && string(result) != "null" {
				var summary struct {
					Source     string          `json:"source"`
					Error      string          `json:"error"`
					Result     json.RawMessage `json:"result"`
					Statements []struct {
						Error  string          `json:"error"`
						Result json.RawMessage `json:"result"`
					} `json:"statements"`
				}
				if json.Unmarshal(result, &summary) != nil {
					return model.WorkspaceDocument{}, errors.New("旧结果格式无效，未发布迁移索引")
				}
				tab.ResultSource = summary.Source
				selected := struct {
					Index int `json:"resultIndex"`
				}{}
				_ = json.Unmarshal(index.ResultViews[tab.ID], &selected)
				failure, data := summary.Error, summary.Result
				if selected.Index >= 0 && selected.Index < len(summary.Statements) {
					failure = summary.Statements[selected.Index].Error
					data = summary.Statements[selected.Index].Result
				}
				if failure != "" {
					tab.ResultStatus = "error"
				} else if len(data) > 0 && string(data) != "null" {
					tab.ResultStatus = "success"
				}

				tab.ResultRef, err = s.part(ctx, compactWorkspaceRun(result))
				if err != nil {
					return model.WorkspaceDocument{}, err
				}
			}
			index.Tabs = append(index.Tabs, tab.WorkspacePage)
		}
	}
	if index.ActiveTab != "" {
		found := false
		for _, page := range index.Tabs {
			found = found || page.ID == index.ActiveTab
		}
		if !found {
			index.ActiveTab = ""
		}
	}
	if index.ActiveTab == "" && len(index.Tabs) > 0 {
		index.ActiveTab = index.Tabs[0].ID
	}
	return s.commitIndex(ctx, index, 0)
}

// CollectWorkspaceParts removes only unreferenced managed blobs by age and orphan budget.
func (s *Store) CollectWorkspaceParts(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	doc, err := s.readWorkspace()
	if err != nil {
		return err
	}
	if doc.Revision == 0 {
		return nil
	}
	keep := map[string]bool{}
	for _, page := range doc.Index.Tabs {
		keep[page.DraftRef] = true
		keep[page.ResultRef] = true
	}
	files, err := os.ReadDir(filepath.Join(s.directory, "workspace-parts"))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	type orphan struct {
		path     string
		modified time.Time
		size     int64
	}
	candidates := []orphan{}
	var total int64
	for _, file := range files {
		if err := ctx.Err(); err != nil {
			return err
		}
		name := file.Name()
		if file.IsDir() || len(name) != 69 || filepath.Ext(name) != ".json" || !workspacePartID.MatchString(name[:64]) || keep[name[:64]] {
			continue
		}
		info, err := file.Info()
		if err != nil {
			return err
		}
		candidates = append(candidates, orphan{filepath.Join(s.directory, "workspace-parts", name), info.ModTime(), info.Size()})
		total += info.Size()
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].modified.Before(candidates[j].modified) })
	for _, file := range candidates {
		if err := ctx.Err(); err != nil {
			return err
		}
		if time.Since(file.modified) > 24*time.Hour || total > 128*1024*1024 {
			if err := os.Remove(file.path); err != nil {
				return fmt.Errorf("清理工作区旧内容失败: %w", err)
			}
			total -= file.size
		}
	}
	return nil
}

// Keep only one copy of an identical last result while retaining all statements and rows.
func compactWorkspaceRun(raw json.RawMessage) json.RawMessage {
	var run map[string]json.RawMessage
	if json.Unmarshal(raw, &run) != nil {
		return raw
	}
	var statements []map[string]json.RawMessage
	if len(run["result"]) == 0 || json.Unmarshal(run["statements"], &statements) != nil || len(statements) == 0 {
		return raw
	}
	var a, b bytes.Buffer
	if json.Compact(&a, run["result"]) != nil || json.Compact(&b, statements[len(statements)-1]["result"]) != nil || !bytes.Equal(a.Bytes(), b.Bytes()) {
		return raw
	}
	delete(run, "result")
	encoded, err := json.Marshal(run)
	if err != nil {
		return raw
	}
	return encoded
}
