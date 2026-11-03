package chat

import (
	"context"
	"errors"
	"sort"
	"sql-studio-backend/internal/model/agent"
	"time"
)

func (s *Service) evictLocked() {
	if len(s.sessions) < 32 {
		return
	}
	var oldest string
	var before time.Time
	for id, v := range s.sessions {
		if !v.busy && (oldest == "" || v.used.Before(before)) {
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
	r, err := s.repo.Load(ctx, id)
	if err != nil {
		return nil, err
	}
	s.evictLocked()
	v := &session{revision: r.Revision, title: r.Title, customTitle: r.CustomTitle, status: r.Status, events: r.Events, messages: r.Messages, summary: r.Summary, used: time.Now(), state: toolState{target: r.State.Target, connections: r.State.Connections, databases: r.State.Databases}}
	if v.state.databases == nil {
		v.state.databases = make(map[string][]string)
	}
	if v.status == "running" {
		v.status = "interrupted"
		v.events = append(v.events, model.Event{Type: "error", Text: "服务曾在执行中退出，本轮未完成；不会自动重放查询。"}, model.Event{Type: "turn_end", Text: "interrupted"})
	}
	s.sessions[id] = v
	return v, nil
}
func (s *Service) saveLocked(ctx context.Context, id string, v *session) error {
	if s.repo == nil {
		return nil
	}
	r, err := s.repo.Save(ctx, model.Conversation{ID: id, Revision: v.revision, Title: v.title, CustomTitle: v.customTitle, Status: v.status, Messages: v.messages, Events: v.events, Summary: v.summary, State: model.DiscoveryState{Target: v.state.target, Connections: v.state.connections, Databases: v.state.databases}})
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
