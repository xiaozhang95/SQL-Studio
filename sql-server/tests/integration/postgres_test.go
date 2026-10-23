package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"sqldesk/internal/connection"
	"sqldesk/internal/httpapi"
	"sqldesk/internal/model"
	"sqldesk/internal/mysql"
	"sqldesk/internal/postgres"
	"sqldesk/internal/service"
)

func TestPostgresIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_PG_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_PG_INTEGRATION=1 with SQLDESK_PG_* to run")
	}
	host := os.Getenv("SQLDESK_PG_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := 5432
	if text := os.Getenv("SQLDESK_PG_PORT"); text != "" {
		var err error
		port, err = strconv.Atoi(text)
		if err != nil {
			t.Fatal(err)
		}
	}
	username := os.Getenv("SQLDESK_PG_USER")
	if username == "" {
		username = "postgres"
	}
	c := model.Connection{Type: model.TypePostgreSQL, Host: host, Port: port, Username: username, Password: os.Getenv("SQLDESK_PG_PASSWORD"), Database: "postgres", Name: "PG test"}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := postgres.Open(ctx, c, "", "")
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(context.Background())
	id := make([]byte, 12)
	if _, err = rand.Read(id); err != nil {
		t.Fatal(err)
	}
	database := "sqldesk_pg_" + hex.EncodeToString(id)
	quote := func(name string) string { return `"` + strings.ReplaceAll(name, `"`, `""`) + `"` }
	if _, err = admin.Exec(ctx, "CREATE DATABASE "+quote(database)); err != nil {
		t.Fatal(err)
	}
	defer func() {
		cleanup, done := context.WithTimeout(context.Background(), 5*time.Second)
		defer done()
		if _, err := admin.Exec(cleanup, "DROP DATABASE "+quote(database)); err != nil {
			t.Errorf("cleanup %s: %v", database, err)
		}
	}()
	c.Database = database
	setup, err := postgres.Open(ctx, c, "", "")
	if err != nil {
		t.Fatal(err)
	}
	schema := `qa "scope`
	table := "records.name"
	qualified := quote(schema) + "." + quote(table)
	for _, statement := range []string{"CREATE SCHEMA " + quote(schema), "CREATE TABLE " + qualified + " (id BIGINT PRIMARY KEY, label TEXT, amount NUMERIC(20,4), payload BYTEA)", "CREATE VIEW " + quote(schema) + `."sample_view" AS SELECT id FROM ` + qualified} {
		if _, err = setup.Exec(ctx, statement); err != nil {
			setup.Close(context.Background())
			t.Fatal(err)
		}
	}
	setup.Close(context.Background())
	client := postgres.NewClient()
	run := func(ctx context.Context, statement string, limit int, write bool) (model.QueryResult, error) {
		return client.Execute(ctx, c, model.QueryRequest{Database: database, Schema: schema, SQL: statement, Limit: limit, AllowWrite: write})
	}
	output, err := run(ctx, "INSERT INTO "+qualified+" VALUES (9007199254740993,NULL,12.3400,decode('00ff','hex')),(2,'中文',99.0000,NULL),(3,'third',1,NULL)", 100, true)
	if err != nil || output.IsQuery || output.AffectedRows != 3 {
		t.Fatalf("insert: %+v %v", output, err)
	}
	output, err = run(ctx, "SELECT id,label,amount,payload,id AS id FROM "+quote(table)+" ORDER BY id DESC", 1, false)
	if err != nil {
		t.Fatal(err)
	}
	if !output.Truncated || output.RowCount != 1 || output.Rows[0][0] != "9007199254740993" || output.Rows[0][1] != nil || output.Rows[0][2] != "12.3400" || output.Rows[0][3] != "0x00ff" || len(output.Columns) != 5 {
		t.Fatalf("result fidelity: %+v", output)
	}
	for _, statement := range []string{"INSERT INTO " + qualified + " (id) VALUES (4)", "WITH ids AS (SELECT 2 AS id) UPDATE " + qualified + " AS t SET label='blocked' FROM ids WHERE t.id=ids.id"} {
		if _, err = run(ctx, statement, 100, false); err == nil {
			t.Fatal("read-only transaction allowed write")
		}
	}
	if _, err = run(ctx, "SELECT 1; SELECT 2", 100, false); err == nil {
		t.Fatal("multiple statements allowed")
	}
	output, err = run(ctx, "INSERT INTO "+qualified+" (id) VALUES (5) RETURNING id", 100, true)
	if err != nil || !output.IsQuery || output.Rows[0][0] != "5" {
		t.Fatalf("returning: %+v %v", output, err)
	}
	short, stop := context.WithTimeout(ctx, 100*time.Millisecond)
	defer stop()
	if _, err = run(short, "SELECT pg_sleep(3)", 100, false); err == nil {
		t.Fatal("timeout ignored")
	}
	tables, err := client.Tables(ctx, c, database)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, item := range tables {
		if item.Schema == schema && item.Name == table {
			found = true
		}
	}
	if !found {
		t.Fatal("schema-qualified table missing")
	}
	ref := model.TableRef{Database: database, Schema: schema, Name: table}
	columns, err := client.Columns(ctx, c, ref)
	if err != nil || len(columns) != 4 || columns[0].Key != "PRI" {
		t.Fatalf("columns: %+v %v", columns, err)
	}
	ddl, err := client.DDL(ctx, c, ref)
	if err != nil || !strings.Contains(ddl, "PRIMARY KEY") || !strings.Contains(ddl, qualified) {
		t.Fatalf("DDL: %s %v", ddl, err)
	}
	ref.Name = "sample_view"
	ddl, err = client.DDL(ctx, c, ref)
	if err != nil || !strings.HasPrefix(ddl, "CREATE VIEW") {
		t.Fatalf("view: %s %v", ddl, err)
	}
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	handler := httpapi.New(service.New(repo, service.NewDatabaseRegistry(mysql.NewClient(), client)))
	for _, kind := range []string{model.TypePostgreSQL, model.TypePolarDBPostgreSQL, model.TypePolarDBOracle} {
		profile := c
		profile.Type = kind
		saved, err := repo.Save(profile)
		if err != nil {
			t.Fatal(err)
		}
		query := url.Values{"database": {database}, "schema": {schema}, "table": {table}}
		for _, path := range []string{"databases", "tables?database=" + database, "columns?" + query.Encode(), "ddl?" + query.Encode()} {
			req := httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections/"+saved.ID+"/"+path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != 200 || !json.Valid(rec.Body.Bytes()) {
				t.Fatalf("%s %s: %d %s", kind, path, rec.Code, rec.Body.String())
			}
		}
	}
	t.Log("verified PostgreSQL protocol, PolarDB PG/Oracle routing, schema quoting, read-only/CTE, precision, bytea, RETURNING, timeouts and Gin metadata on a temporary PostgreSQL database; cloud PolarDB itself is not exercised")
}
