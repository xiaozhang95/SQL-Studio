package agent

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	model "sql-studio-backend/internal/model/agent"
	"time"
)

func (s *Service) evictLocked() {
	if len(s.sessions) < 32 {
		return
	}
	var oldest string
	var before time.Time
	for id, v := range s.sessions {
		if !v.busy && v.saving == 0 && (oldest == "" || v.used.Before(before)) {
			oldest = id
			before = v.used
		}
	}
	if oldest != "" && s.repo != nil {
		delete(s.sessions, oldest)
	}
}
func (s *Service) loadLocked(ctx context.Context, id string) (*session, error) {
	if v := s.sessions[id]; v != nil {
		return v, nil
	}
	if s.repo == nil {
		return nil, errors.New("会话不存在")
	}
	if pending := s.loading[id]; pending != nil {
		s.mu.Unlock()
		select {
		case <-pending:
		case <-ctx.Done():
		}
		s.mu.Lock()
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		return s.loadLocked(ctx, id)
	}
	pending := make(chan struct{})
	s.loading[id] = pending
	s.mu.Unlock()
	r, err := s.repo.Load(ctx, id)
	s.mu.Lock()
	delete(s.loading, id)
	close(pending)
	if err != nil {
		return nil, err
	}
	s.evictLocked()
	compact := []model.Event{}
	for _, e := range r.Events {
		compact = appendEvent(compact, e)
	}
	v := &session{eventVersion: 1, revision: r.Revision, title: r.Title, customTitle: r.CustomTitle, status: r.Status, events: compact, messages: r.Messages, summary: r.Summary, used: time.Now(), state: toolState{target: r.State.Target, connections: r.State.Connections, databases: r.State.Databases}}
	if v.state.databases == nil {
		v.state.databases = make(map[string][]string)
	}
	if v.status == "running" {
		v.status = "interrupted"
		v.events = append(v.events, model.Event{Type: "error", Text: "服务曾在执行中退出，本轮未完成；不会自动重放查询。"}, model.Event{Type: "turn_end", Text: "interrupted"})
	}
	s.sessions[id] = v
	if r.Status == "running" || len(compact) != len(r.Events) {
		if err := s.saveLocked(ctx, id, v); err != nil {
			delete(s.sessions, id)
			return nil, err
		}
	}
	return v, nil
}
func (s *Service) saveLocked(ctx context.Context, id string, v *session) error {
	if s.repo == nil {
		return nil
	}
	v.saving++
	s.mu.Unlock()
	v.persistMu.Lock()
	s.mu.Lock()
	snapshot := model.Conversation{ID: id, Revision: v.revision, Title: v.title, CustomTitle: v.customTitle, Status: v.status, Messages: append([]model.Message(nil), v.messages...), Events: append([]model.Event(nil), v.events...), Summary: v.summary, State: model.DiscoveryState{Target: v.state.target, Connections: v.state.connections, Databases: v.state.clone().databases}}
	s.mu.Unlock()
	r, err := s.repo.Save(ctx, snapshot)
	s.mu.Lock()
	v.persistMu.Unlock()
	v.saving--
	if err != nil {
		return err
	}
	v.revision = r.Revision
	v.used = r.UpdatedAt
	v.checkpoint = time.Now()
	return nil
}
func (s *Service) List(ctx context.Context) ([]model.ConversationInfo, error) {
	if s.repo != nil {
		return s.repo.List(ctx)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []model.ConversationInfo{}
	for id, v := range s.sessions {
		out = append(out, info(id, v))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}
func info(id string, v *session) model.ConversationInfo {
	return model.ConversationInfo{ID: id, Title: v.title, Revision: v.revision, Status: v.status, UpdatedAt: v.used}
}
func (s *Service) View(ctx context.Context, id string) (model.ConversationView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, err := s.loadLocked(ctx, id)
	if err != nil {
		return model.ConversationView{}, err
	}
	return model.ConversationView{ConversationInfo: info(id, v), Events: append([]model.Event{}, v.events...), Busy: v.busy}, nil
}

// ViewPage bounds each response and rejects mixing revisions during restoration.
func (s *Service) ViewPage(ctx context.Context, id string, offset int, revision uint64, eventVersion ...uint64) (model.ConversationView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	v, err := s.loadLocked(ctx, id)
	if err != nil {
		return model.ConversationView{}, err
	}
	if (revision != 0 && revision != v.revision) || (len(eventVersion) > 0 && eventVersion[0] != v.eventVersion) {
		return model.ConversationView{}, model.ErrConflict
	}
	if offset < 0 || offset > len(v.events) {
		return model.ConversationView{}, errors.New("会话分页位置无效")
	}
	end, size := offset, 0
	for end < len(v.events) && end-offset < 256 {
		raw, err := json.Marshal(v.events[end])
		if err != nil {
			return model.ConversationView{}, err
		}
		if end > offset && size+len(raw) > 256*1024 {
			break
		}
		size += len(raw)
		end++
	}
	page := model.ConversationView{EventVersion: v.eventVersion, ConversationInfo: info(id, v), Events: append([]model.Event{}, v.events[offset:end]...), Busy: v.busy}
	if end < len(v.events) {
		page.NextOffset = &end
	}
	return page, nil
}
