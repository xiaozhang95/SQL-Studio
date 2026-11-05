package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model/agent"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

type session struct {
	revision    uint64
	title       string
	customTitle bool
	status      string
	events      []model.Event
	summary     model.ContextSummary
	checkpoint  time.Time
	state       toolState
	messages    []model.Message
	busy        bool
	used        time.Time
}
type toolState struct {
	allowWrite           bool
	target               model.Target
	connections          []model.Connection
	databases            map[string][]string
	unavailableDatabases map[string]json.RawMessage // Only used within the current turn.
}

func (v toolState) clone() toolState {
	out := toolState{target: v.target, connections: append([]model.Connection(nil), v.connections...), databases: make(map[string][]string)}
	for k, names := range v.databases {
		out.databases[k] = append([]string(nil), names...)
	}
	return out
}

type Service struct {
	approvals map[string]*pendingApproval
	mu        sync.Mutex
	sessions  map[string]*session
	model     Generator
	db        Database
	slots     chan struct{}
	repo      Repository
}

func New(g Generator, db Database, repositories ...Repository) *Service {
	s := &Service{approvals: map[string]*pendingApproval{}, sessions: map[string]*session{}, model: g, db: db, slots: make(chan struct{}, 2)}
	if len(repositories) > 0 {
		s.repo = repositories[0]
	}
	return s
}

// Create starts an unbound conversation without accessing a database.
func (s *Service) Create(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.createLocked(ctx)
}

// Ensure creates only when the persistent index is empty, including concurrent callers.
func (s *Service) Ensure(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return "", err
	}
	if s.repo != nil {
		items, err := s.repo.List(ctx)
		if err != nil {
			return "", err
		}
		if len(items) > 0 {
			return items[0].ID, nil
		}
	} else {
		for id := range s.sessions {
			return id, nil
		}
	}
	return s.createLocked(ctx)
}
func (s *Service) createLocked(ctx context.Context) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	var token [24]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", err
	}
	id := hex.EncodeToString(token[:])
	s.evictLocked()
	s.sessions[id] = &session{state: toolState{databases: make(map[string][]string)}, messages: []model.Message{{Role: "system", Content: systemPrompt()}}, used: time.Now(), title: "新建会话", status: "idle"}
	if err := s.saveLocked(ctx, id, s.sessions[id]); err != nil {
		delete(s.sessions, id)
		return "", err
	}
	return id, nil
}

func (s *Service) Rename(ctx context.Context, id, title string) (model.ConversationInfo, error) {
	title = strings.TrimSpace(title)
	if title == "" || utf8.RuneCountInString(title) > 80 || strings.IndexFunc(title, unicode.IsControl) >= 0 {
		return model.ConversationInfo{}, errors.New("会话名称须为1到80个字符，不能包含换行或控制字符")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	v, err := s.loadLocked(ctx, id)
	if err != nil {
		return model.ConversationInfo{}, err
	}
	if v.busy {
		return model.ConversationInfo{}, errors.New("请先停止当前请求再重命名")
	}
	oldTitle, oldCustom := v.title, v.customTitle
	v.title, v.customTitle = title, true
	if err = s.saveLocked(ctx, id, v); err != nil {
		v.title, v.customTitle = oldTitle, oldCustom
		return model.ConversationInfo{}, err
	}
	return info(id, v), nil
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
