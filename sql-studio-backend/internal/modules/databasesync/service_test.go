package databasesync

import (
	"context"
	"errors"
	"testing"

	"sql-studio-backend/internal/model"
)

type syncTestConnections map[string]model.Connection

func (c syncTestConnections) Get(id string) (model.Connection, error) {
	if connection, ok := c[id]; ok {
		return connection, nil
	}
	return model.Connection{}, errors.New("unknown fixture connection")
}

// Embedding the interface makes an unexpected call to a driver fail the test.
type syncTestEngine struct {
	Engine
	sources []model.Connection
	targets []model.Connection
}

func (e *syncTestEngine) CheckDatabaseSync(_ context.Context, source, target model.Connection, _ model.DatabaseSyncRequest) (model.DatabaseSyncPlan, error) {
	e.sources = append(e.sources, source)
	e.targets = append(e.targets, target)
	return model.DatabaseSyncPlan{Tables: 1}, nil
}

func TestResolveSameEngineAndExternalCredentials(t *testing.T) {
	const database = "sample"
	for _, kind := range []string{model.TypeMySQL, model.TypeMariaDB, model.TypePostgreSQL, model.TypeGreptimeDB} {
		t.Run(kind, func(t *testing.T) {
			driver := &syncTestEngine{}
			repository := syncTestConnections{
				"saved":    {Type: kind},
				"postgres": {Type: model.TypePostgreSQL},
				"greptime": {Type: model.TypeGreptimeDB},
			}
			service := New(repository, map[string]Engine{kind: driver, model.TypePostgreSQL: driver, model.TypeGreptimeDB: driver})
			input := model.DatabaseSyncRequest{
				SourceConnectionID: "saved", SourceDatabase: database, TargetDatabase: "fresh",
				Structure: true, CreateDatabase: true,
				TargetExternal: &model.DatabaseSyncExternal{Type: kind, Host: "127.0.0.1", Port: 12345, Username: "qa"},
			}
			if kind == model.TypeGreptimeDB {
				input.TargetExternal.Username = ""
				input.TargetExternal.Database = "public"
			}
			if kind == model.TypePostgreSQL {
				input.TargetExternal.Database = "postgres"
			}
			plan, err := service.Check(context.Background(), input)
			if err != nil || plan.Tables != 1 || len(driver.sources) != 1 || driver.sources[0].Type != kind || driver.targets[0].Type != kind || driver.targets[0].Database != input.TargetExternal.Database {
				t.Fatalf("same-engine dispatch failed: %+v %v", plan, err)
			}
			input.TargetExternal = nil
			input.TargetConnectionID = "postgres"
			if kind == model.TypePostgreSQL {
				input.TargetConnectionID = "greptime"
			}
			if _, err := service.Check(context.Background(), input); err == nil || len(driver.sources) != 1 {
				t.Fatalf("cross-engine request reached driver: %v", err)
			}
			if err := service.Run(context.Background(), input, func(model.DatabaseSyncProgress) error { return nil }); err == nil {
				t.Fatal("cross-engine run succeeded")
			}
		})
	}
}
