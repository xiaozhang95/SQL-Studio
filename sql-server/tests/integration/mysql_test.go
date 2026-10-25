package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"sqldesk/internal/connection"
	"sqldesk/internal/httpapi"
	"sqldesk/internal/model"
	"sqldesk/internal/modules/connections"
	"sqldesk/internal/modules/metadata"
	"sqldesk/internal/modules/query"
	"sqldesk/internal/mysql"
)

// Opt in explicitly. All writes are confined to a fresh, random test database.
func TestMySQLIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_INTEGRATION=1 and SQLDESK_MYSQL_PASSWORD to run")
	}
	c := model.Connection{Name: "integration", Host: "127.0.0.1", Port: 3306, Username: "root", Password: os.Getenv("SQLDESK_MYSQL_PASSWORD")}
	if h := os.Getenv("SQLDESK_MYSQL_HOST"); h != "" {
		c.Host = h
	}
	db, err := mysql.Open(c, "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	randomID := make([]byte, 16)
	if _, err := rand.Read(randomID); err != nil {
		t.Fatal(err)
	}
	schema := "sqldesk_test_" + hex.EncodeToString(randomID)
	name := "`" + schema + "`"
	if _, err = db.ExecContext(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanCtx, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if _, err := db.ExecContext(cleanCtx, "DROP DATABASE "+name); err != nil {
			t.Errorf("cleanup failed for %s: %v", schema, err)
		}
	}()
	table := name + ".`sample`"
	if _, err = db.ExecContext(ctx, "CREATE TABLE "+table+" (id BIGINT PRIMARY KEY, label VARCHAR(100) NULL, amount DECIMAL(20,4))"); err != nil {
		t.Fatal(err)
	}
	client := mysql.NewClient()
	run := func(ctx context.Context, statement string, limit int, write bool) (model.QueryResult, error) {
		return client.Execute(ctx, c, model.QueryRequest{SQL: statement, Limit: limit, AllowWrite: write})
	}
	output, err := run(ctx, "INSERT INTO "+table+" VALUES (9007199254740993, NULL, 12.3400), (2, '中文', 99.0000), (3, 'three', 1)", 100, true)
	if err != nil || output.AffectedRows != 3 {
		t.Fatalf("write: %+v %v", output, err)
	}
	output, err = run(ctx, "SELECT id, label, amount, id AS id FROM "+table+" ORDER BY id DESC", 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if !output.Truncated || output.RowCount != 1 || output.Rows[0][0] != "9007199254740993" || output.Rows[0][1] != nil || output.Rows[0][2] != "12.3400" || len(output.Columns) != 4 {
		t.Fatalf("result fidelity: %+v", output)
	}
	for _, statement := range []string{"INSERT INTO " + table + " VALUES (4,'blocked',0)", "/* comment */ UPDATE " + table + " SET label='blocked'", "WITH ids AS (SELECT 2 AS id) UPDATE " + table + " JOIN ids ON sample.id=ids.id SET label='blocked'"} {
		if _, err = run(ctx, statement, 100, false); err == nil {
			t.Fatalf("read-only allowed write: %s", statement)
		}
	}
	if _, err = run(ctx, "SELECT 1; SELECT 2", 100, false); err == nil {
		t.Fatal("multiple statements allowed")
	}
	output, err = run(ctx, "WITH ids AS (SELECT 2 AS id) UPDATE "+table+" JOIN ids ON sample.id=ids.id SET label='updated'", 100, true)
	if err != nil || output.IsQuery || output.AffectedRows != 1 {
		t.Fatalf("CTE write feedback: %+v %v", output, err)
	}
	output, err = run(ctx, "SELECT X'00FF' AS binary_value", 100, false)
	if err != nil || output.Rows[0][0] != "0x00ff" {
		t.Fatalf("binary result: %+v %v", output, err)
	}
	short, stop := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer stop()
	if _, err = run(short, "SELECT SLEEP(3)", 100, false); err == nil {
		t.Fatal("timeout not enforced")
	}
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(c)
	if err != nil {
		t.Fatal(err)
	}
	handler := httpapi.New(httpapi.Services{Connections: connections.New(store, client), Metadata: metadata.New(store, client), Queries: query.New(store, client)})
	for _, path := range []string{"databases", "tables?database=" + schema, "columns?database=" + schema + "&table=sample", "ddl?database=" + schema + "&table=sample"} {
		req := httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections/"+saved.ID+"/"+path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != 200 || !json.Valid(rec.Body.Bytes()) {
			t.Fatalf("metadata %s: %d %s", path, rec.Code, rec.Body.String())
		}
		if strings.HasPrefix(path, "ddl") && !strings.Contains(rec.Body.String(), "CREATE TABLE") {
			t.Fatal("DDL missing")
		}
	}
	t.Log("verified writes, read-only protection, CTE rejection, limits, duplicate aliases, NULL, BIGINT, DECIMAL, timeout, metadata; test database cleaned automatically")
}
