package integration_test

import (
	"context"
	"crypto/rand"
	"os"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/greptimedb"
	"sql-studio-backend/internal/model"
)

func TestGreptimeDBIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_GREPTIMEDB_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_GREPTIMEDB_INTEGRATION=1 to run against an isolated local GreptimeDB")
	}
	port := 4002
	if value := os.Getenv("SQLDESK_GREPTIMEDB_PORT"); value != "" {
		var err error
		port, err = strconv.Atoi(value)
		if err != nil || port < 1 || port > 65535 {
			t.Fatalf("invalid SQLDESK_GREPTIMEDB_PORT: %q", value)
		}
	}
	connection := model.Connection{
		Type: model.TypeGreptimeDB, Host: "127.0.0.1", Port: port,
		Username: os.Getenv("SQLDESK_GREPTIMEDB_USERNAME"), Password: os.Getenv("SQLDESK_GREPTIMEDB_PASSWORD"),
	}
	client := greptimedb.NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	database := "sqldesk_greptime_" + strings.ToLower(rand.Text())
	execute := func(database, sql string, allowWrite bool) model.QueryResult {
		t.Helper()
		result, err := client.Execute(ctx, connection, model.QueryRequest{Database: database, SQL: sql, Limit: 10, AllowWrite: allowWrite})
		if err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
		return result
	}
	execute("public", "CREATE DATABASE `"+database+"`", true)
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		for _, statement := range []model.QueryRequest{
			{Database: database, SQL: "DROP VIEW IF EXISTS samples_view", AllowWrite: true},
			{Database: database, SQL: "DROP TABLE IF EXISTS samples", AllowWrite: true},
			{Database: "public", SQL: "DROP DATABASE `" + database + "`", AllowWrite: true},
		} {
			if _, err := client.Execute(cleanup, connection, statement); err != nil {
				t.Errorf("cleanup %s: %v", statement.SQL, err)
			}
		}
		databases, err := client.Databases(cleanup, connection)
		if err != nil || slices.Contains(databases, database) {
			t.Errorf("verify cleanup of %s: %v; databases: %v", database, err, databases)
		}
	})
	execute(database, "CREATE TABLE samples (ts TIMESTAMP(3) TIME INDEX, host STRING, amount DECIMAL(18,4))", true)
	execute(database, "CREATE VIEW samples_view AS SELECT ts, host AS label, amount + CAST(1 AS DECIMAL(18,4)) AS total FROM samples", true)

	ref := model.TableRef{Database: database, Name: "samples_view"}
	columns, err := client.Columns(ctx, connection, ref)
	want := []string{"ts", "label", "total"}
	if err != nil || len(columns) != len(want) {
		t.Fatalf("view columns = %+v, error = %v; want %v", columns, err, want)
	}
	for i, column := range columns {
		if column.Name != want[i] || column.Type == "" {
			t.Fatalf("view column %d = %+v; want %s with a type", i, column, want[i])
		}
	}
	baseColumns, err := client.Columns(ctx, connection, model.TableRef{Database: database, Name: "samples"})
	if err != nil || len(baseColumns) != 3 || baseColumns[0].Key != "TIME INDEX" {
		t.Fatalf("table columns = %+v, error = %v", baseColumns, err)
	}
	for _, sql := range []string{`USE "` + database + `";`, `USE /* scope */ "` + database + `"; -- tail`, "USE `" + database + "`;"} {
		if result := execute("public", sql, false); result.IsQuery || len(result.Rows) != 0 {
			t.Fatalf("%s returned %+v", sql, result)
		}
	}
	for _, sql := range []string{`USE "` + database + `"; SELECT 1`, `USE "` + database + `_missing"`} {
		if _, err := client.Execute(ctx, connection, model.QueryRequest{Database: "public", SQL: sql, Limit: 10}); err == nil {
			t.Fatalf("expected %s to fail", sql)
		}
	}
}
