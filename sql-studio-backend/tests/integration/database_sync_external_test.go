package integration_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/httpapi"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/databasesync"
	"sql-studio-backend/internal/mysql"
)

func TestMySQLDatabaseSyncExternal(t *testing.T) {
	if os.Getenv("SQLDESK_SYNC_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_SYNC_INTEGRATION=1 with two isolated MySQL ports")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	open := func(env string) (model.DatabaseSyncExternal, *sql.DB) {
		t.Helper()
		port, err := strconv.Atoi(os.Getenv(env))
		if err != nil || port < 1 || port > 65535 {
			t.Fatalf("invalid %s", env)
		}
		credentials := model.DatabaseSyncExternal{Host: "127.0.0.1", Port: port, Username: "root", Password: os.Getenv("SQLDESK_MYSQL_PASSWORD")}
		db, err := mysql.Open(model.Connection{Type: model.TypeMySQL, Host: credentials.Host, Port: port, Username: credentials.Username, Password: credentials.Password}, "")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Close() })
		return credentials, db
	}
	source, from := open("SQLDESK_MYSQL_PORT")
	target, to := open("SQLDESK_SYNC_TARGET_PORT")
	var suffix [8]byte
	if _, err := rand.Read(suffix[:]); err != nil {
		t.Fatal(err)
	}
	stem := "sync_ext_" + hex.EncodeToString(suffix[:])
	database := stem + "_src"
	exec := func(db *sql.DB, statement string) {
		t.Helper()
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatal(err)
		}
	}
	cleanup := func(db *sql.DB, name string) {
		t.Cleanup(func() {
			if _, err := db.Exec("DROP DATABASE IF EXISTS " + name); err != nil {
				t.Error(err)
			}
		})
	}
	cleanup(from, database)
	exec(from, "CREATE DATABASE "+database)
	exec(from, "CREATE TABLE "+database+".sample (id BIGINT PRIMARY KEY, note VARCHAR(50), bytes VARBINARY(6))")
	exec(from, "INSERT INTO "+database+".sample VALUES (9007199254740993,'源 😀',X'00FF'), (2,'',X''), (3,NULL,NULL)")

	stateDirectory := t.TempDir()
	store, err := connection.Open(stateDirectory)
	if err != nil {
		t.Fatal(err)
	}
	router := httpapi.New(httpapi.Services{DatabaseSync: databasesync.New(store, map[string]databasesync.Engine{model.TypeMySQL: mysql.NewClient()})})
	post := func(path string, input any, origin string) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest("POST", "http://127.0.0.1/api/database-sync/"+path, bytes.NewReader(body)).WithContext(ctx)
		r.Header.Set("Content-Type", "application/json")
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		router.ServeHTTP(w, r)
		if source.Password != "" && strings.Contains(w.Body.String(), source.Password) {
			t.Fatal("database password was returned")
		}
		return w
	}
	list := model.DatabaseSyncConnection{External: &source}
	input := model.DatabaseSyncRequest{SourceExternal: &source, SourceDatabase: database, TargetExternal: &target, TargetDatabase: stem + "_dst", Structure: true, Data: true, CreateDatabase: true}
	if res := post("databases", list, "http://example.test"); res.Code != 403 {
		t.Fatalf("cross-origin probe allowed: %d", res.Code)
	}
	invalid := []model.DatabaseSyncConnection{
		{},
		{ConnectionID: "saved", External: &source},
		{External: &model.DatabaseSyncExternal{Host: "http://127.0.0.1", Port: 3306, Username: "root"}},
		{External: &model.DatabaseSyncExternal{Host: "127.0.0.1", Port: 65536, Username: "root"}},
		{External: &model.DatabaseSyncExternal{Host: "127.0.0.1:3306", Port: 3306, Username: "root"}},
		{External: &model.DatabaseSyncExternal{Host: "[127.0.0.1]", Port: 3306, Username: "root"}},
	}
	for _, v := range invalid {
		if res := post("databases", v, ""); res.Code != 400 {
			t.Fatalf("invalid input accepted: %d %s", res.Code, res.Body)
		}
	}
	res := post("databases", list, "")
	var names []string
	if res.Code != 200 || json.Unmarshal(res.Body.Bytes(), &names) != nil || !slices.Contains(names, database) || slices.Contains(names, "mysql") {
		t.Fatalf("incorrect database list: %d %s", res.Code, res.Body)
	}
	if res := post("check", input, ""); res.Code != 200 {
		t.Fatalf("check failed: %d %s", res.Code, res.Body)
	}
	for _, config := range []struct {
		name        string
		credentials model.DatabaseSyncExternal
	}{
		{"wrong_password", model.DatabaseSyncExternal{Host: source.Host, Port: source.Port, Username: source.Username, Password: "invalid-fixture-password"}},
		{"untrusted_tls", model.DatabaseSyncExternal{Host: source.Host, Port: source.Port, Username: source.Username, Password: source.Password, TLS: true}},
	} {
		t.Run(config.name, func(t *testing.T) {
			failure := input
			failure.TargetDatabase = stem + "_" + config.name
			failure.SourceExternal = &config.credentials
			cleanup(to, failure.TargetDatabase)
			if res := post("check", failure, ""); res.Code != 400 {
				t.Fatalf("unexpected check response: %d %s", res.Code, res.Body)
			}
			if res := post("run", failure, ""); !strings.Contains(res.Body.String(), `"type":"error"`) || strings.Contains(res.Body.String(), `"type":"done"`) {
				t.Fatalf("unexpected success: %s", res.Body)
			}
		})
	}
	verify := func(config model.DatabaseSyncRequest, expected int) {
		t.Helper()
		cleanup(to, config.TargetDatabase)
		res := post("run", config, "")
		if res.Code != 200 || !strings.Contains(res.Body.String(), `"type":"done"`) {
			t.Fatalf("run failed: %d %s", res.Code, res.Body)
		}
		var count int
		if err := to.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+config.TargetDatabase+".sample").Scan(&count); err != nil || count != expected {
			t.Fatalf("unexpected row count %d: %v", count, err)
		}
	}
	verify(input, 3)

	t.Run("data copy uses one read snapshot across tables", func(t *testing.T) {
		exec(from, "CREATE TABLE "+database+".z_later (id INT PRIMARY KEY)")
		exec(from, "INSERT INTO "+database+".z_later VALUES (1)")
		defer exec(from, "DROP TABLE "+database+".z_later")
		config := input
		config.TargetDatabase = stem + "_snapshot"
		cleanup(to, config.TargetDatabase)
		svc := databasesync.New(store, map[string]databasesync.Engine{model.TypeMySQL: mysql.NewClient()})
		edited := false
		if err := svc.Run(ctx, config, func(progress model.DatabaseSyncProgress) error {
			if !edited && progress.Phase == "table_done" && progress.Table == "sample" {
				edited = true
				_, err := from.ExecContext(ctx, "INSERT INTO "+database+".z_later VALUES (2)")
				return err
			}
			return nil
		}); err != nil || !edited {
			t.Fatalf("snapshot sync failed: %v", err)
		}
		var n int
		if err := to.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+config.TargetDatabase+".z_later").Scan(&n); err != nil || n != 1 {
			t.Fatalf("later table did not use the same source snapshot: %d, %v", n, err)
		}
	})

	t.Run("target connection loss preserves acknowledged batch and frees the slot", func(t *testing.T) {
		// A uniquely scoped target account lets the test identify only its own connection.
		user := stem
		account := "'" + user + "'@'%'"
		created := stem + "_killed"
		exec(to, "CREATE USER "+account+" IDENTIFIED BY 'ephemeral-interruption-key'")
		defer exec(to, "DROP USER "+account)
		exec(to, "GRANT CREATE, INSERT ON `"+strings.ReplaceAll(created, "_", `\_`)+"`.* TO "+account)
		exec(from, "INSERT INTO "+database+".sample (id) WITH RECURSIVE n AS (SELECT 10 AS x UNION ALL SELECT x+1 FROM n WHERE x<309) SELECT x FROM n")
		defer exec(from, "DELETE FROM "+database+".sample WHERE id BETWEEN 10 AND 309")
		config := input
		config.TargetDatabase = created
		limited := target
		limited.Username, limited.Password = user, "ephemeral-interruption-key"
		config.TargetExternal = &limited
		cleanup(to, created)
		svc := databasesync.New(store, map[string]databasesync.Engine{model.TypeMySQL: mysql.NewClient()})
		killed := false
		fail := svc.Run(ctx, config, func(progress model.DatabaseSyncProgress) error {
			if !killed && progress.Rows >= 128 {
				var id uint64
				if err := to.QueryRowContext(ctx, "SELECT ID FROM information_schema.PROCESSLIST WHERE USER = ? AND DB = ?", user, created).Scan(&id); err != nil {
					return err
				}
				exec(to, "KILL CONNECTION "+strconv.FormatUint(id, 10))
				killed = true
			}
			return nil
		})
		if !killed || fail == nil {
			t.Fatalf("target interruption was not reported: %v", fail)
		}
		var n int
		if err := to.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+created+".sample").Scan(&n); err != nil || n != 128 {
			t.Fatalf("acknowledged rows were lost or extra rows written: %d, %v", n, err)
		}
		config.TargetExternal = &target
		config.TargetDatabase = stem + "_after_kill"
		cleanup(to, config.TargetDatabase)
		if err := svc.Run(ctx, config, func(model.DatabaseSyncProgress) error { return nil }); err != nil {
			t.Fatalf("next task after interruption failed: %v", err)
		}
	})
	var note, raw string
	if err := to.QueryRowContext(ctx, "SELECT note, HEX(bytes) FROM "+input.TargetDatabase+".sample WHERE id=9007199254740993").Scan(&note, &raw); err != nil || note != "源 😀" || raw != "00FF" {
		t.Fatalf("unexpected persisted data: %q, %q, %v", note, raw, err)
	}
	if res := post("run", input, ""); !strings.Contains(res.Body.String(), "目标数据库已存在") {
		t.Fatalf("existing target not protected: %s", res.Body)
	}
	if len(store.List()) != 0 {
		t.Fatal("using only external connections persisted a saved connection")
	}
	if _, err := os.Stat(filepath.Join(stateDirectory, "connections.json")); !os.IsNotExist(err) {
		t.Fatalf("external-only requests wrote the connection file: %v", err)
	}

	save := func(label string, endpoint model.DatabaseSyncExternal) string {
		t.Helper()
		c, err := store.Save(model.Connection{Type: model.TypeMySQL, Name: label, Host: endpoint.Host, Port: endpoint.Port, Username: endpoint.Username, Password: endpoint.Password})
		if err != nil {
			t.Fatal(err)
		}
		return c.ID
	}
	mixed := input
	mixed.SourceConnectionID, mixed.SourceExternal = save("saved source", source), nil
	mixed.TargetDatabase, mixed.Data = stem+"_mixed_a", false
	verify(mixed, 0)
	mixed = input
	mixed.TargetConnectionID, mixed.TargetExternal = save("saved target", target), nil
	mixed.TargetDatabase = stem + "_mixed_b"
	verify(mixed, 3)
	if len(store.List()) != 2 {
		t.Fatal("a mixed sync saved another connection")
	}
}
