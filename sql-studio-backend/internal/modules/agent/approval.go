package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"regexp"
	model "sql-studio-backend/internal/model/agent"
)

type pendingApproval struct{ result chan bool }

var errWriteCancelled = errors.New("用户取消本次操作，未执行SQL")

// ConfirmWrite resolves a single-use, unguessable approval bound to an active tool call.
func (s *Service) ConfirmWrite(id string, allow bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.approvals[id]
	if p == nil {
		return errors.New("确认已过期或已处理")
	}
	delete(s.approvals, id)
	p.result <- allow
	return nil
}
func (s *Service) approveWrite(ctx context.Context, state *toolState, sql string, emit func(model.Event) error) error {
	if emit == nil {
		return errors.New("写入必须由用户逐次确认")
	}
	var nonce [24]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return err
	}
	id := hex.EncodeToString(nonce[:])
	p := &pendingApproval{result: make(chan bool, 1)}
	s.mu.Lock()
	s.approvals[id] = p
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.approvals, id); s.mu.Unlock() }()
	connection := state.target.ConnectionID
	for _, c := range state.connections {
		if c.ID == state.target.ConnectionID {
			connection = c.Name
		}
	}
	identifier := "(?:\"(?:[^\"]|\"\")*\"|`(?:[^`]|``)*`|[A-Za-z_][A-Za-z0-9_]*)"
	pattern := "(?i)(?:UPDATE|INTO|TABLE|VIEW|INDEX)\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(" + identifier + "(?:\\s*\\.\\s*" + identifier + ")*)"
	objects := regexp.MustCompile(pattern).FindStringSubmatch(sql)
	names := []string{}
	if len(objects) > 1 {
		names = append(names, objects[1])
	}
	value, _ := json.Marshal(struct {
		ID         string   `json:"approvalId"`
		Connection string   `json:"connection"`
		Database   string   `json:"database"`
		Objects    []string `json:"objects"`
		SQL        string   `json:"sql"`
	}{id, connection, state.target.Database, names, sql})
	if err := emit(model.Event{Type: "write_confirmation", Result: value}); err != nil {
		return err
	}
	select {
	case allow := <-p.result:
		if err := ctx.Err(); err != nil {
			return err
		}
		if !allow {
			return errWriteCancelled
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
