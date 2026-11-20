package database

import (
	"context"
	"errors"
	"testing"

	"sql-studio-backend/internal/model"
)

type probe struct {
	Engine
	name           string
	received       model.Connection
	input          model.QueryRequest
	queryError     error
	queryErrorKind model.QueryErrorKind
}

func (p *probe) Test(_ context.Context, c model.Connection) (string, error) {
	p.received = c
	return p.name, nil
}
func (p *probe) Execute(ctx context.Context, c model.Connection, q model.QueryRequest) (model.QueryResult, error) {
	p.received = c
	p.input = q
	if p.queryError != nil {
		return model.QueryResult{}, p.queryError
	}
	return model.QueryResult{}, ctx.Err()
}
func (p *probe) ClassifyQueryError(error) model.QueryErrorKind { return p.queryErrorKind }

func TestExecutePreservesOriginalErrorAndClassification(t *testing.T) {
	cause := errors.New("driver detail")
	engine := &probe{queryError: cause, queryErrorKind: model.QueryErrorCheck}
	client := New(map[string]Engine{model.TypeMariaDB: engine})
	_, err := client.Execute(context.Background(), model.Connection{Type: model.TypeMariaDB}, model.QueryRequest{SQL: "INSERT ..."})
	var classified *model.QueryError
	if !errors.As(err, &classified) || classified.Kind != model.QueryErrorCheck || !errors.Is(err, cause) || err.Error() != cause.Error() {
		t.Fatalf("incomplete query error: %v", err)
	}
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
