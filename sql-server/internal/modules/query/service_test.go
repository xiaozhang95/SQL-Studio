package query_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"sqldesk/internal/connection"
	"sqldesk/internal/model"
	"sqldesk/internal/modules/query"
)

type stubDatabase struct {
	execute func(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}

func (d *stubDatabase) Execute(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
	return d.execute(ctx, c, q)
}

func TestQueryConcurrencyAndSlotRelease(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := repo.Save(model.Connection{Name: "test", Host: "localhost", Port: 3306, Username: "root"})
	if err != nil {
		t.Fatal(err)
	}
	entered := make(chan struct{}, 4)
	release := make(chan struct{})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	driver := &stubDatabase{execute: func(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
		entered <- struct{}{}
		select {
		case <-release:
			return model.QueryResult{}, nil
		case <-ctx.Done():
			return model.QueryResult{}, ctx.Err()
		}
	}}
	svc := query.New(repo, driver)
	var group sync.WaitGroup
	for i := 0; i < 4; i++ {
		group.Go(func() { _, _ = svc.Query(ctx, saved.ID, model.QueryRequest{SQL: "SELECT 1"}) })
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("queries did not start")
		}
	}
	_, err = svc.Query(ctx, saved.ID, model.QueryRequest{SQL: "SELECT 1"})
	close(release)
	group.Wait()
	if !errors.Is(err, query.ErrBusy) {
		t.Fatal("fifth query was not rejected")
	}
	if _, err = svc.Query(ctx, saved.ID, model.QueryRequest{SQL: "SELECT 1"}); err != nil {
		t.Fatal("query slot not released")
	}
}
