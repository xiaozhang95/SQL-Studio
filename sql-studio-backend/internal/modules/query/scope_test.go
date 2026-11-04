package query_test

import (
	"context"
	"errors"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/query"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type scopeConnections struct{}

func (scopeConnections) Get(id string) (model.Connection, error) {
	return model.Connection{ID: id}, nil
}

func TestExecutionScopesSeparateExecutorsAndShareQueryBudget(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	entered := make(chan struct{}, 4)
	release := make(chan struct{})
	var workspaceCalls, agentCalls atomic.Int32
	executor := func(name string, calls *atomic.Int32) *stubDatabase {
		return &stubDatabase{execute: func(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
			calls.Add(1)
			if c.ID != "same-connection" || q.Database != "same-database" || q.Limit != 5000 {
				t.Error("execution scope lost target or limits", c.ID, q)
			}
			entered <- struct{}{}
			select {
			case <-release:
				return model.QueryResult{Rows: [][]any{{name}}}, nil
			case <-ctx.Done():
				return model.QueryResult{}, ctx.Err()
			}
		}}
	}
	workspace := query.New(scopeConnections{}, executor("workspace", &workspaceCalls))
	agent := workspace.WithExecutor(executor("agent", &agentCalls))
	input := model.QueryRequest{Database: "same-database", SQL: "SELECT 1", Limit: 6000}
	var workers sync.WaitGroup
	for _, service := range []*query.Service{workspace, agent, workspace, agent} {
		workers.Go(func() { _, _ = service.Query(ctx, "same-connection", input) })
	}
	for i := 0; i < 4; i++ {
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("execution scopes did not start")
		}
	}
	for _, service := range []*query.Service{workspace, agent} {
		if _, err := service.Query(ctx, "same-connection", input); !errors.Is(err, query.ErrBusy) {
			t.Error("execution scope bypassed process query budget", err)
		}
	}
	close(release)
	workers.Wait()
	if workspaceCalls.Load() != 2 || agentCalls.Load() != 2 {
		t.Fatal("execution scopes shared an executor", workspaceCalls.Load(), agentCalls.Load())
	}
	for _, item := range []struct {
		service *query.Service
		name    string
	}{{workspace, "workspace"}, {agent, "agent"}} {
		result, err := item.service.Query(ctx, "same-connection", input)
		if err != nil || len(result.Rows) != 1 || result.Rows[0][0] != item.name {
			t.Fatal("execution scope mutated original executor or retained a query slot", item.name, result, err)
		}
	}
}
