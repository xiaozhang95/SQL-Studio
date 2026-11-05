package query_test

import (
	"context"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/query"
)

func TestQueryPolicies(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := repo.Save(model.Connection{Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "saved-secret"})
	if err != nil {
		t.Fatal(err)
	}
	wantLimit := 1000
	wantMatched := false
	driver := &stubDatabase{execute: func(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
		if c.ID != saved.ID || c.Password != "saved-secret" {
			t.Fatal("query did not resolve target credential")
		}
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 30*time.Second {
			t.Fatal("query timeout missing")
		}
		if q.Limit != wantLimit || q.AllowWrite || q.MatchRows != wantMatched {
			t.Fatal("query limit or read-only default changed")
		}
		return model.QueryResult{}, nil
	}}
	svc := query.New(repo, driver)
	for _, limit := range []int{0, 9000} {
		if limit > 5000 {
			wantLimit = 5000
			wantMatched = true
		}
		if _, err = svc.Query(context.Background(), saved.ID, model.QueryRequest{SQL: "SELECT 1", Limit: limit, MatchRows: wantMatched}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = svc.Query(context.Background(), saved.ID, model.QueryRequest{SQL: "  "}); err == nil {
		t.Fatal("empty SQL accepted")
	}
}
