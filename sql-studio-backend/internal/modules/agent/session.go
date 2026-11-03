package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"sql-studio-backend/internal/model/agent"
	"sync"
	"time"
)

type session struct {
	revision   uint64
	title      string
	status     string
	events     []model.Event
	summary    model.ContextSummary
	checkpoint time.Time
	state      toolState
	messages   []model.Message
	busy       bool
	used       time.Time
}
type toolState struct {
	target      model.Target
	connections []model.Connection
	databases   map[string][]string
}

func (v toolState) clone() toolState {
	out := toolState{target: v.target, connections: append([]model.Connection(nil), v.connections...), databases: make(map[string][]string)}
	for k, names := range v.databases {
		out.databases[k] = append([]string(nil), names...)
	}
	return out
}

type Service struct {
	mu       sync.Mutex
	sessions map[string]*session
	model    Generator
	db       Database
	slots    chan struct{}
	repo     Repository
}

func New(g Generator, db Database, repositories ...Repository) *Service {
	s := &Service{sessions: map[string]*session{}, model: g, db: db, slots: make(chan struct{}, 2)}
	if len(repositories) > 0 {
		s.repo = repositories[0]
	}
	return s
}

// Create starts an unbound conversation without accessing a database.
func (s *Service) Create(ctx context.Context) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	var token [24]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", err
	}
	id := hex.EncodeToString(token[:])
	s.mu.Lock()
	defer s.mu.Unlock()
	s.evictLocked()
	s.sessions[id] = &session{state: toolState{databases: make(map[string][]string)}, messages: []model.Message{{Role: "system", Content: systemPrompt()}}, used: time.Now(), title: "新对话", status: "idle"}
	if err := s.saveLocked(ctx, id, s.sessions[id]); err != nil {
		delete(s.sessions, id)
		return "", err
	}
	return id, nil
}
func (s *Service) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	v := s.sessions[id]
	if v != nil && v.busy {
		return errors.New("请先停止当前请求")
	}
	if s.repo != nil {
		if err := s.repo.Delete(context.Background(), id); err != nil {
			return err
		}
	}
	delete(s.sessions, id)
	return nil
}
