package integration_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/database"
	"sql-studio-backend/internal/httpapi"
	"sql-studio-backend/internal/mariadb"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
)

// Writes are confined to a new random database; credentials only come from the environment.
func TestMariaDBIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_MARIADB_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_MARIADB_INTEGRATION=1 and SQLDESK_MARIADB_PASSWORD")
	}
	port := 3307
	if value := os.Getenv("SQLDESK_MARIADB_PORT"); value != "" {
		var err error
		port, err = strconv.Atoi(value)
		if err != nil {
			t.Fatal(err)
		}
	}
	host := os.Getenv("SQLDESK_MARIADB_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	c := model.Connection{Type: model.TypeMariaDB, Name: "MariaDB integration", Host: host, Port: port, Username: "root", Password: os.Getenv("SQLDESK_MARIADB_PASSWORD")}
	client := mariadb.NewClient()
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	version, err := client.Test(ctx, c)
	if err != nil || !strings.Contains(version, "MariaDB") {
		t.Fatalf("MariaDB handshake: %q %v", version, err)
	}
	t.Log("server:", version)
	random := make([]byte, 12)
	if _, err = rand.Read(random); err != nil {
		t.Fatal(err)
	}
	db := "sqldesk_mariadb_" + hex.EncodeToString(random)
	run := func(statement string, write bool) (model.QueryResult, error) {
		return client.Execute(ctx, c, model.QueryRequest{Database: db, SQL: statement, AllowWrite: write, Limit: 5000})
	}
	if _, err = client.Execute(ctx, c, model.QueryRequest{SQL: "CREATE DATABASE `" + db + "` CHARACTER SET utf8mb4", AllowWrite: true}); err != nil {
		t.Fatal(err)
	}
	defer func() {
		clean, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if err := client.SetSession(clean, c, &db, true); err != nil {
			t.Error(err)
		}
		if _, err := client.Execute(clean, c, model.QueryRequest{SQL: "DROP DATABASE `" + db + "`", AllowWrite: true}); err != nil {
			t.Errorf("cleanup %s: %v", db, err)
		}
		remaining, err := client.Databases(clean, c)
		if err != nil {
			t.Error(err)
		}
		for _, name := range remaining {
			if name == db {
				t.Errorf("temporary database was not removed: %s", db)
			}
		}
	}()
	for _, statement := range []string{
		"CREATE TABLE sample (id BIGINT PRIMARY KEY, label VARCHAR(100) DEFAULT 'NULL', amount DECIMAL(20,4), payload BLOB, calc BIGINT AS (id+1) PERSISTENT)",
		"CREATE VIEW sample_view AS SELECT id,label FROM sample",
		"CREATE SEQUENCE sample_sequence START WITH 10",
		"INSERT INTO sample(id,label,amount,payload) VALUES (9007199254740993,NULL,12.3400,0x00ff), (2,'中文',99.0000,X'')",
	} {
		if _, err = run(statement, true); err != nil {
			t.Fatal(err)
		}
	}
	result, err := run("SELECT id,label,amount,payload,calc FROM sample ORDER BY id DESC", false)
	if err != nil || len(result.Rows) != 2 || result.Rows[0][0] != "9007199254740993" || result.Rows[0][1] != nil || result.Rows[0][2] != "12.3400" || result.Rows[0][3] != "0x00ff" || result.Rows[0][4] != "9007199254740994" {
		t.Fatalf("exact values: %+v %v", result, err)
	}
	for _, statement := range []string{"INSERT INTO sample(id) VALUES(3) RETURNING id,label", "DELETE FROM sample WHERE id=3 RETURNING id"} {
		result, err = run(statement, true)
		if err != nil || !result.IsQuery || len(result.Rows) != 1 || result.Rows[0][0] != "3" {
			t.Fatalf("RETURNING: %+v %v", result, err)
		}
	}
	result, err = run("/*M! SELECT 42 AS vendor_comment */", true)
	if err != nil || len(result.Rows) != 1 || result.Rows[0][0] != "42" {
		t.Fatalf("vendor comment result: %+v %v", result, err)
	}
	for _, statement := range []string{"CREATE TABLE blocked(id INT)", "INSERT INTO sample(id) VALUES(4)", "/*M! CREATE TABLE blocked(id INT) */", "SELECT /*M! SQL_NO_CACHE */ 1"} {
		if _, err = run(statement, false); err == nil {
			t.Fatalf("read-only allowed %s", statement)
		}
	}
	if _, err = run("UPDATE sample SET label='changed' WHERE id=2", true); err != nil {
		t.Fatal(err)
	}
	columns, err := client.Columns(ctx, c, model.TableRef{Database: db, Name: "sample"})
	if err != nil || len(columns) != 5 || columns[1].Default == nil || *columns[1].Default != "'NULL'" || !strings.Contains(columns[4].Extra, "GENERATED") {
		t.Fatalf("column metadata: %+v %v", columns, err)
	}
	indexes, err := client.Indexes(ctx, c, model.TableRef{Database: db, Name: "sample"})
	if err != nil || len(indexes) == 0 || indexes[0].Name != "PRIMARY" {
		t.Fatalf("indexes: %+v %v", indexes, err)
	}
	ddl, err := client.DDL(ctx, c, model.TableRef{Database: db, Name: "sample"})
	if err != nil || !strings.Contains(ddl, "GENERATED ALWAYS AS") {
		t.Fatalf("DDL: %s %v", ddl, err)
	}
	tables, err := client.Tables(ctx, c, db)
	if err != nil || len(tables) != 2 {
		t.Fatalf("table/view listing excludes sequence: %+v %v", tables, err)
	}
	for start := 0; start < 6100; start += 500 {
		values := []string{}
		for i := start; i < start+500 && i < 6100; i++ {
			values = append(values, fmt.Sprintf("(%d,'batch')", 10000+i))
		}
		if _, err = run("INSERT INTO sample(id,label) VALUES "+strings.Join(values, ","), true); err != nil {
			t.Fatal(err)
		}
	}
	rows := 0
	err = client.StreamTableData(ctx, c, model.TableRef{Database: db, Name: "sample"}, func(chunk model.QueryResult) error { rows += len(chunk.Rows); return nil })
	if err != nil || rows != 6102 {
		t.Fatalf("streamed %d rows: %v", rows, err)
	}
	slow, stop := context.WithTimeout(ctx, 150*time.Millisecond)
	_, err = client.Execute(slow, c, model.QueryRequest{Database: db, SQL: "SELECT SLEEP(10)", Limit: 1, AllowWrite: true})
	stop()
	if err == nil {
		t.Fatal("cancelled query succeeded")
	}
	if _, err = run("SELECT 1", false); err != nil {
		t.Fatal("query after cancellation:", err)
	}
	if err = client.SetSession(ctx, c, &db, false); err != nil {
		t.Fatal(err)
	}
	if _, err = run("SELECT 1", false); err == nil {
		t.Fatal("closed database accepted query")
	}
	if err = client.SetSession(ctx, c, &db, true); err != nil {
		t.Fatal(err)
	}
	// Actual HTTP decoding, credential storage and engine dispatch against the same real server.
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	dispatch := database.New(map[string]database.Engine{model.TypeMariaDB: mariadb.NewClient()})
	service := connections.New(repo, dispatch)
	saved, err := service.SaveConnection(c)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Type != model.TypeMariaDB || saved.Password != "" || !saved.HasPassword {
		t.Fatal("connection identity or redaction failed")
	}
	router := httpapi.New(httpapi.Services{Connections: service, Metadata: metadata.New(repo, dispatch), Queries: query.New(repo, dispatch)})
	input, _ := json.Marshal(model.QueryRequest{Database: db, SQL: "SELECT id FROM sample WHERE id=2", Limit: 10})
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest("POST", "http://127.0.0.1/api/connections/"+saved.ID+"/query", strings.NewReader(string(input))))
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"2"`) {
		t.Fatalf("HTTP: %d %s", rec.Code, rec.Body.String())
	}
}
