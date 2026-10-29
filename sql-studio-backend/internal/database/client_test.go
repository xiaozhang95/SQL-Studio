package database

import (
	"context"
	"errors"
	"sql-studio-backend/internal/model"
	"testing"
)

type probe struct {
	Engine
	name     string
	received model.Connection
	input    model.QueryRequest
}

func (p *probe) Test(_ context.Context, c model.Connection) (string, error) {
	p.received = c
	return p.name, nil
}
func (p *probe) Execute(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
	p.received = c
	p.input = q
	return model.QueryResult{}, ctx.Err()
}
func TestDispatchPreservesTargetAndRejectsUnknown(t *testing.T) {
	mysql, maria, pg := &probe{name: "mysql"}, &probe{name: "mariadb"}, &probe{name: "postgresql"}
	registry := map[string]Engine{model.TypeMySQL: mysql, model.TypeMariaDB: maria, model.TypePostgreSQL: pg}
	client := New(registry)
	delete(registry, model.TypePostgreSQL)
	for _, kind := range []string{"", model.TypeMySQL, model.TypeMariaDB, model.TypePostgreSQL} {
		got, err := client.Test(context.Background(), model.Connection{ID: "target", Type: kind})
		if err != nil || got != model.NormalizeDatabaseType(kind) {
			t.Fatal("incorrect engine dispatch")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := client.Execute(ctx, model.Connection{ID: "pg-target", Type: model.TypePostgreSQL}, model.QueryRequest{Database: "db", SQL: "SELECT 1", Limit: 42})
	if !errors.Is(err, context.Canceled) || pg.received.ID != "pg-target" || pg.input.Database != "db" || pg.input.Limit != 42 {
		t.Fatal("target, policy or cancellation lost")
	}
	if _, err := client.Test(context.Background(), model.Connection{Type: "unknown"}); err == nil {
		t.Fatal("unknown engine fell back")
	}
}
