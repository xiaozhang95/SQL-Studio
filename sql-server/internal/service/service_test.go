package service_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"sqldesk/internal/connection"
	"sqldesk/internal/model"
	"sqldesk/internal/service"
)

type stubDatabase struct {
	test    func(context.Context, model.Connection) (string, error)
	execute func(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}

func (d *stubDatabase) Test(ctx context.Context, c model.Connection) (string, error) {
	return d.test(ctx, c)
}
func (d *stubDatabase) Execute(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
	return d.execute(ctx, c, q)
}
func (d *stubDatabase) Databases(context.Context, model.Connection) ([]string, error) {
	return []string{}, nil
}
func (d *stubDatabase) Tables(context.Context, model.Connection, string) ([]model.Table, error) {
	return []model.Table{}, nil
}
func (d *stubDatabase) Columns(context.Context, model.Connection, model.TableRef) ([]model.Column, error) {
	return []model.Column{}, nil
}
func (d *stubDatabase) DDL(context.Context, model.Connection, model.TableRef) (string, error) {
	return "", nil
}

func TestConnectionAndQueryPolicies(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	driver := &stubDatabase{}
	driver.test = func(ctx context.Context, c model.Connection) (string, error) {
		if c.Password != "saved-secret" {
			t.Fatal("stored password was not resolved")
		}
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 7*time.Second {
			t.Fatal("connection timeout missing")
		}
		return "test", nil
	}
	driver.execute = func(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
		if c.Password != "saved-secret" {
			t.Fatal("query did not resolve credential")
		}
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 30*time.Second {
			t.Fatal("query timeout missing")
		}
		if q.Limit != 1000 && q.Limit != 5000 {
			t.Fatal("query limit was not normalized")
		}
		if q.AllowWrite {
			t.Fatal("read-only default changed")
		}
		return model.QueryResult{}, nil
	}
	svc := service.New(repo, driver)
	saved, err := svc.SaveConnection(model.Connection{Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "saved-secret"})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Password != "" {
		t.Fatal("saved response leaked password")
	}
	if _, err = svc.SaveConnection(model.Connection{Name: "invalid"}); err == nil {
		t.Fatal("invalid connection accepted")
	}
	if _, err = svc.TestConnection(context.Background(), saved); err != nil {
		t.Fatal(err)
	}
	for _, limit := range []int{0, 9000} {
		if _, err = svc.Query(context.Background(), saved.ID, model.QueryRequest{SQL: "SELECT 1", Limit: limit}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = svc.Query(context.Background(), saved.ID, model.QueryRequest{SQL: "  "}); err == nil {
		t.Fatal("empty SQL accepted")
	}
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
	svc := service.New(repo, driver)
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
	if !errors.Is(err, service.ErrBusy) {
		t.Fatal("fifth query was not rejected")
	}
	if _, err = svc.Query(ctx, saved.ID, model.QueryRequest{SQL: "SELECT 1"}); err != nil {
		t.Fatal("query slot not released")
	}
}
