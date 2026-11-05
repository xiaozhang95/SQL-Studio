package chat

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	model "sql-studio-backend/internal/model/agent"
	"time"
)

type pendingApproval struct {
	event  string
	result chan bool
	wait   context.Context
}

const (
	writeConfirmation    = "write_confirmation"
	continueConfirmation = "continue_confirmation"
	approvalTimeout      = 5 * time.Minute
)

var errWriteCancelled = errors.New("用户取消本次操作，未执行SQL")

type writeApprovalError struct{ error }

func (e writeApprovalError) Unwrap() error { return e.error }

// ConfirmWrite resolves a single-use, unguessable approval bound to an active tool call.
func (s *Service) ConfirmWrite(id string, allow bool) error {
	return s.confirm(id, writeConfirmation, allow)
}

func (s *Service) ConfirmContinue(id string, allow bool) error {
	return s.confirm(id, continueConfirmation, allow)
}

func (s *Service) confirm(id, event string, allow bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.approvals[id]
	if p == nil || p.event != event || p.wait.Err() != nil {
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
	connection := state.target.ConnectionID
	for _, c := range state.connections {
		if c.ID == state.target.ConnectionID {
			connection = c.Name
		}
	}
	names := approvalObjects(sql)
	return s.awaitApproval(ctx, writeConfirmation, errWriteCancelled, emit, func(id string) any {
		return struct {
			ID         string   `json:"approvalId"`
			Connection string   `json:"connection"`
			Database   string   `json:"database"`
			Objects    []string `json:"objects"`
			SQL        string   `json:"sql"`
		}{id, connection, state.target.Database, names, sql}
	})
}

func (s *Service) approveContinue(ctx context.Context, kind, detail string, emit func(model.Event) error) error {
	return s.awaitApproval(ctx, continueConfirmation, model.ErrContinueCancelled, emit, func(id string) any {
		return struct {
			ID     string `json:"approvalId"`
			Kind   string `json:"kind"`
			Detail string `json:"detail"`
		}{id, kind, detail}
	})
}

func (s *Service) awaitApproval(ctx context.Context, event string, declined error, emit func(model.Event) error, payload func(string) any) error {
	if budget, ok := ctx.Value(turnBudgetKey{}).(*turnBudget); ok {
		budget.pause()
		defer budget.resume()
	}
	if err := context.Cause(ctx); err != nil {
		return err
	}
	var nonce [24]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return err
	}
	id := hex.EncodeToString(nonce[:])
	wait, cancel := context.WithTimeout(ctx, approvalTimeout)
	defer cancel()
	p := &pendingApproval{event: event, result: make(chan bool, 1), wait: wait}
	s.mu.Lock()
	s.approvals[id] = p
	s.mu.Unlock()
	defer func() { s.mu.Lock(); delete(s.approvals, id); s.mu.Unlock() }()
	value, err := json.Marshal(payload(id))
	if err != nil {
		return err
	}
	if err := emit(model.Event{Type: event, Result: value}); err != nil {
		return err
	}
	select {
	case allow := <-p.result:
		if wait.Err() != nil {
			break
		}
		if !allow {
			return declined
		}
		return nil
	case <-wait.Done():
	}
	if err := context.Cause(ctx); err != nil {
		return err
	}
	return errors.New("等待确认超时，本轮已停止")
}
