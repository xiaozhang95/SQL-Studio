package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/postgresql"
)

func TestPostgreSQLIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_PG_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_PG_INTEGRATION=1 and SQLDESK_PG_PASSWORD to run")
	}
	c := model.Connection{ID: "integration", Type: model.TypePostgreSQL, Host: "127.0.0.1", Port: 5432, Username: "postgres", Password: os.Getenv("SQLDESK_PG_PASSWORD"), Database: "postgres"}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	db, err := postgresql.Open(c, "postgres")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	b := make([]byte, 16)
	if _, err = rand.Read(b); err != nil {
		t.Fatal(err)
	}
	schema := "sqldesk_test_" + hex.EncodeToString(b)
	if _, err = db.ExecContext(ctx, `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, stop := context.WithTimeout(context.Background(), 5*time.Second)
		defer stop()
		if _, err := db.ExecContext(cleanup, `DROP SCHEMA "`+schema+`" CASCADE`); err != nil {
			t.Errorf("cleanup %s: %v", schema, err)
		}
	}()
	if _, err = db.ExecContext(ctx, `CREATE TABLE "`+schema+`".sample (id bigint PRIMARY KEY, label text, amount numeric(20,4))`); err != nil {
		t.Fatal(err)
	}
	client := postgresql.NewClient()
	if _, err = client.Test(ctx, c); err != nil {
		t.Fatal(err)
	}
	req := model.QueryRequest{Database: "postgres", Schema: schema, SQL: `INSERT INTO sample VALUES (9007199254740993, NULL, 12.3400)`, AllowWrite: true, Limit: 100}
	result, err := client.Execute(ctx, c, req)
	if err != nil || result.AffectedRows != 1 {
		t.Fatalf("insert: %+v %v", result, err)
	}
	req.AllowWrite = false
	if _, err = client.Execute(ctx, c, req); err == nil {
		t.Fatal("read-only allowed insert")
	}
	req.SQL = `SELECT id, label, amount, id AS id FROM sample`
	result, err = client.Execute(ctx, c, req)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Rows) != 1 || result.Rows[0][0] != "9007199254740993" || result.Rows[0][1] != nil || result.Rows[0][2] != "12.3400" || len(result.Columns) != 4 {
		t.Fatalf("result: %+v", result)
	}
	ref := model.TableRef{Database: "postgres", Name: `"` + schema + `"."sample"`}
	schemas, err := client.Schemas(ctx, c, "postgres")
	if err != nil || !strings.Contains(strings.Join(schemas, ","), schema) {
		t.Fatalf("schemas: %v %v", schemas, err)
	}
	tables, err := client.Tables(ctx, c, "postgres")
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, table := range tables {
		if table.Name == ref.Name {
			found = true
		}
	}
	if !found {
		t.Fatal("test table missing")
	}
	columns, err := client.Columns(ctx, c, ref)
	if err != nil || len(columns) != 3 {
		t.Fatalf("columns: %+v %v", columns, err)
	}
	indexes, err := client.Indexes(ctx, c, ref)
	if err != nil || len(indexes) == 0 {
		t.Fatalf("indexes: %+v %v", indexes, err)
	}
	ddl, err := client.DDL(ctx, c, ref)
	if err != nil || !strings.Contains(ddl, "CREATE TABLE") {
		t.Fatalf("DDL: %s %v", ddl, err)
	}
	req.SQL = `INSERT INTO sample VALUES (2, 'returning', 2) RETURNING id`
	req.AllowWrite = true
	result, err = client.Execute(ctx, c, req)
	if err != nil || len(result.Rows) != 1 || result.Rows[0][0] != "2" {
		t.Fatalf("RETURNING: %+v %v", result, err)
	}
	req.SQL = `SELECT 1; SELECT 2`
	if _, err = client.Execute(ctx, c, req); err == nil {
		t.Fatal("multiple statements allowed")
	}
	req.AllowWrite = false
	req.SQL = `SELECT id FROM sample ORDER BY id`
	req.Limit = 1
	result, err = client.Execute(ctx, c, req)
	if err != nil || !result.Truncated || result.RowCount != 1 {
		t.Fatalf("row limit: %+v %v", result, err)
	}
	req.SQL = `SELECT pg_sleep(3)`
	short, stop := context.WithTimeout(ctx, 100*time.Millisecond)
	defer stop()
	if _, err = client.Execute(short, c, req); err == nil {
		t.Fatal("timeout not enforced")
	}
	t.Log("verified connection, schema, tables, columns, indexes, DDL, read-only, write and result fidelity")
}
