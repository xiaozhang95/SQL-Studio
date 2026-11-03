package app

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
	"sql-studio-backend/internal/modules/query"
	"strings"
	"sync"
	"testing"
	"time"
)

type agentRepo struct{}

func (agentRepo) Get(id string) (model.Connection, error) {
	return model.Connection{ID: id, Password: "must-not-leak"}, nil
}

type agentExecutor struct {
	call func(context.Context, model.QueryRequest) (model.QueryResult, error)
}

func (e agentExecutor) Execute(ctx context.Context, _ model.Connection, q model.QueryRequest) (model.QueryResult, error) {
	return e.call(ctx, q)
}
func TestAgentQueriesUseSharedBudgetAndReadOnlyLimit(t *testing.T) {
	entered, release := make(chan struct{}, 4), make(chan struct{})
	var wg sync.WaitGroup
	service := query.New(agentRepo{}, agentExecutor{func(ctx context.Context, q model.QueryRequest) (model.QueryResult, error) {
		entered <- struct{}{}
		select {
		case <-release:
		case <-ctx.Done():
		}
		return model.QueryResult{}, nil
	}})
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, _ = service.Query(ctx, "fixture", model.QueryRequest{SQL: "SELECT 1"}) }()
	}
	for i := 0; i < 4; i++ {
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("budget fixture timed out")
		}
	}
	adapter := agentDatabase{queries: service}
	_, err := adapter.Execute(ctx, agentmodel.Target{ConnectionID: "fixture", Database: "demo"}, "query_readonly", "", "SELECT 1")
	close(release)
	wg.Wait()
	if !errors.Is(err, query.ErrBusy) {
		t.Fatal("agent bypassed shared budget", err)
	}
	adapter.queries = query.New(agentRepo{}, agentExecutor{func(_ context.Context, q model.QueryRequest) (model.QueryResult, error) {
		if q.AllowWrite || q.Limit != 100 || q.Database != "demo" {
			t.Error("read-only contract lost", q)
		}
		return model.QueryResult{Columns: []model.ResultColumn{{Name: "value", Type: "BIGINT"}}, Rows: [][]any{{"9007199254740993"}}}, nil
	}})
	data, err := adapter.Execute(ctx, agentmodel.Target{ConnectionID: "fixture", Database: "demo"}, "query_readonly", "", "SELECT 1")
	if err != nil {
		t.Fatal(err)
	}
	var out model.QueryResult
	if json.Unmarshal(data, &out) != nil || out.Rows[0][0] != "9007199254740993" {
		t.Fatal("precision lost")
	}
}

func TestAgentDatabaseErrorsDoNotExposeDriverCredentials(t *testing.T) {
	adapter := agentDatabase{queries: query.New(agentRepo{}, agentExecutor{func(context.Context, model.QueryRequest) (model.QueryResult, error) {
		return model.QueryResult{}, errors.New("host=private-host user=private-user password=must-not-leak")
	}})}
	_, err := adapter.Execute(context.Background(), agentmodel.Target{ConnectionID: "fixture"}, "query_readonly", "", "SELECT 1")
	if err == nil || strings.Contains(err.Error(), "private-") || strings.Contains(err.Error(), "must-not-leak") {
		t.Fatal("driver details leaked")
	}
}
