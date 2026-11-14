package integration_test

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"os"
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

func TestMySQLDatabaseSync(t *testing.T) {
	if os.Getenv("SQLDESK_SYNC_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_SYNC_INTEGRATION=1, SQLDESK_MYSQL_PASSWORD and two isolated MySQL ports")
	}
	open := func(env string) (model.Connection, *sql.DB) {
		t.Helper()
		port, err := strconv.Atoi(os.Getenv(env))
		if err != nil || port < 1 || port > 65535 {
			t.Fatalf("invalid %s", env)
		}
		c := model.Connection{Name: env, Type: model.TypeMySQL, Host: "127.0.0.1", Port: port, Username: "root", Password: os.Getenv("SQLDESK_MYSQL_PASSWORD")}
		db, err := mysql.Open(c, "")
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { db.Close() })
		return c, db
	}
	source, from := open("SQLDESK_MYSQL_PORT")
	target, to := open("SQLDESK_SYNC_TARGET_PORT")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var random [8]byte
	if _, err := rand.Read(random[:]); err != nil {
		t.Fatal(err)
	}
	stem := "sync_" + hex.EncodeToString(random[:])
	sourceName := stem + "_src"
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
	exec(from, "CREATE DATABASE "+sourceName+" CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs")
	cleanup(from, sourceName)
	exec(from, "CREATE TABLE "+sourceName+".parent (id BIGINT PRIMARY KEY, label VARCHAR(50), amount DECIMAL(24,4), payload VARBINARY(6), flags BIT(8), j JSON, dt DATETIME(6), calc BIGINT AS (id+2) STORED, hidden VARCHAR(20) INVISIBLE)")
	exec(from, "CREATE TABLE "+sourceName+".child (id INT PRIMARY KEY, pid BIGINT, FOREIGN KEY (pid) REFERENCES "+sourceName+".parent (id))")
	exec(from, "CREATE TABLE "+sourceName+".auto_id (id INT PRIMARY KEY AUTO_INCREMENT) COMMENT='TABLESPACE and DATA DIRECTORY in a comment'")
	exec(from, "INSERT INTO "+sourceName+".parent (id,label,amount,payload,flags,j,dt,hidden) VALUES (9007199254740993,'中文😀',12345678901234567890.1200,X'00FF',b'10000001','{\"v\":1}','2026-11-14 02:03:04.123456','invisible'),(2,'',0,X'',b'0',NULL,NULL,NULL),(3,NULL,0,NULL,NULL,NULL,NULL,NULL)")
	exec(from, "INSERT INTO "+sourceName+".child VALUES (1,9007199254740993)")
	exec(from, "INSERT INTO "+sourceName+".auto_id VALUES (1)")
	exec(from, "INSERT INTO "+sourceName+".auto_id (id) WITH RECURSIVE n AS (SELECT 2 AS id UNION ALL SELECT id+1 FROM n WHERE id<300) SELECT id FROM n")
	exec(from, "CREATE VIEW "+sourceName+".v AS SELECT id FROM "+sourceName+".parent")
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := databasesync.New(store, map[string]databasesync.Engine{model.TypeMySQL: mysql.NewClient()})
	save := func(c model.Connection) string {
		stored, err := store.Save(c)
		if err != nil {
			t.Fatal(err)
		}
		return stored.ID
	}
	input := model.DatabaseSyncRequest{SourceConnectionID: save(source), SourceDatabase: sourceName, TargetConnectionID: save(target), TargetDatabase: stem + "_dst", Structure: true, Data: true, CreateDatabase: true}
	router := httpapi.New(httpapi.Services{DatabaseSync: svc})
	request := func(path string, value model.DatabaseSyncRequest) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest("POST", "http://127.0.0.1/api/database-sync/"+path, strings.NewReader(string(body))).WithContext(ctx)
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(recorder, request)
		return recorder
	}
	count := func(db *sql.DB, query string, args ...any) int {
		t.Helper()
		var n int
		if err := db.QueryRowContext(ctx, query, args...).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	exists := func(name string) int {
		return count(to, "SELECT COUNT(*) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?", name)
	}

	if res := request("check", input); res.Code != 200 || !strings.Contains(res.Body.String(), `"tables":3,"skippedViews":1`) || exists(input.TargetDatabase) != 0 {
		t.Fatalf("invalid preflight: %d %s", res.Code, res.Body)
	}
	noCreate := input
	noCreate.CreateDatabase = false
	if res := request("check", noCreate); res.Code != 400 || exists(input.TargetDatabase) != 0 {
		t.Fatalf("create opt-in not enforced: %d %s", res.Code, res.Body)
	}
	cleanup(to, input.TargetDatabase)
	res := request("run", input)
	var done bool
	var rowUpdates int
	var final model.DatabaseSyncProgress
	for _, line := range strings.Split(strings.TrimSpace(res.Body.String()), "\n") {
		var event struct {
			Type     string                     `json:"type"`
			Progress model.DatabaseSyncProgress `json:"progress"`
		}
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			t.Fatal(err)
		}
		switch event.Type {
		case "done":
			done = true
		case "progress":
			if event.Progress.Rows > final.Rows {
				rowUpdates++
			}
			final = event.Progress
		}
	}
	if res.Code != 200 || !done || final.Completed != 3 || final.Tables != 3 || final.SkippedViews != 1 || final.Rows != 304 || rowUpdates < 5 {
		t.Fatalf("bad transfer: %d %s", res.Code, res.Body)
	}
	if n := count(to, "SELECT COUNT(*) FROM "+input.TargetDatabase+".parent WHERE (id=9007199254740993 AND label='中文😀' AND amount=12345678901234567890.1200 AND HEX(payload)='00FF' AND flags=129 AND JSON_EXTRACT(j,'$.v')=1 AND dt='2026-11-14 02:03:04.123456' AND calc=9007199254740995 AND hidden='invisible') OR (id=2 AND label='' AND payload=X'') OR (id=3 AND label IS NULL AND payload IS NULL)"); n != 3 {
		t.Fatalf("unexpected data matches: %d", n)
	}
	if n := count(to, "SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME='parent'", input.TargetDatabase, input.TargetDatabase); n != 1 {
		t.Fatalf("foreign key not retargeted: %d", n)
	}
	if res := request("run", input); !strings.Contains(res.Body.String(), "目标数据库已存在") || count(to, "SELECT COUNT(*) FROM "+input.TargetDatabase+".parent") != 3 {
		t.Fatalf("existing target not rejected: %s", res.Body)
	}

	unsafe := input
	unsafe.TargetDatabase = stem + "_unsupported"
	cleanup(to, unsafe.TargetDatabase)
	exec(from, "CREATE TABLE "+sourceName+".unsafe_table (id INT) ENGINE=MyISAM")
	if res := request("run", unsafe); !strings.Contains(res.Body.String(), "仅支持同步 InnoDB 表") || exists(unsafe.TargetDatabase) != 0 {
		t.Fatalf("unsupported table should stop before writing: %s", res.Body)
	}
	exec(from, "DROP TABLE "+sourceName+".unsafe_table")

	structure := input
	structure.TargetDatabase, structure.Data = stem+"_structure", false
	cleanup(to, structure.TargetDatabase)
	if res := request("run", structure); !strings.Contains(res.Body.String(), `"type":"done"`) || count(to, "SELECT COUNT(*) FROM "+structure.TargetDatabase+".parent") != 0 {
		t.Fatalf("structure-only transfer: %s", res.Body)
	}

	race := input
	race.TargetDatabase = stem + "_race"
	cleanup(to, race.TargetDatabase)
	if res := request("check", race); res.Code != 200 {
		t.Fatalf("race preflight: %s", res.Body)
	}
	exec(to, "CREATE DATABASE "+race.TargetDatabase)
	exec(to, "CREATE TABLE "+race.TargetDatabase+".sentinel (id INT)")
	if res := request("run", race); !strings.Contains(res.Body.String(), "目标数据库已存在") || count(to, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME='sentinel'", race.TargetDatabase) != 1 {
		t.Fatalf("target created after preflight not protected: %s", res.Body)
	}

	t.Run("target defaults to autocommit off", func(t *testing.T) {
		exec(to, "SET GLOBAL autocommit=0")
		defer exec(to, "SET GLOBAL autocommit=1")
		config := input
		config.TargetDatabase = stem + "_autocommit"
		cleanup(to, config.TargetDatabase)
		res := request("run", config)
		if !strings.Contains(res.Body.String(), `"type":"done"`) || count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".auto_id") != 300 {
			t.Fatalf("reported success without committing the target rows: %s", res.Body)
		}
	})

	t.Run("accent distinct target names and case collision", func(t *testing.T) {
		existing := stem + "_e"
		config := input
		config.TargetDatabase = stem + "_é"
		cleanup(to, existing)
		cleanup(to, "`"+config.TargetDatabase+"`")
		exec(to, "CREATE DATABASE "+existing)
		if res := request("check", config); res.Code != 200 {
			t.Fatalf("an accent-distinct database was treated as identical: %s", res.Body)
		}
		caseCollision := config
		caseCollision.TargetDatabase = strings.ToUpper(existing)
		if res := request("check", caseCollision); res.Code != 400 || !strings.Contains(res.Body.String(), "目标数据库已存在") {
			t.Fatalf("case variant not blocked: %s", res.Body)
		}
		if res := request("run", config); !strings.Contains(res.Body.String(), `"type":"done"`) {
			t.Fatalf("could not sync the distinct name: %s", res.Body)
		}
	})

	t.Run("source DDL remains stable between plan and data", func(t *testing.T) {
		config := input
		config.TargetDatabase = stem + "_source_lock"
		cleanup(to, config.TargetDatabase)
		var attempted bool
		err := svc.Run(ctx, config, func(p model.DatabaseSyncProgress) error {
			if p.Phase != "created" {
				return nil
			}
			attempted = true
			lockCtx, cancel := context.WithTimeout(ctx, 250*time.Millisecond)
			defer cancel()
			_, err := from.ExecContext(lockCtx, "ALTER TABLE "+sourceName+".auto_id ADD COLUMN in_flight INT")
			if err == nil {
				_, _ = from.ExecContext(ctx, "ALTER TABLE "+sourceName+".auto_id DROP COLUMN in_flight")
				t.Error("source DDL changed after the plan was checked")
			} else if lockCtx.Err() != context.DeadlineExceeded {
				t.Errorf("unexpected error: %v", err)
			}
			return nil
		})
		if err != nil || !attempted {
			t.Fatalf("copy failed: %v", err)
		}
		lockCtx, release := context.WithTimeout(ctx, time.Second)
		defer release()
		if _, err := from.ExecContext(lockCtx, "ALTER TABLE "+sourceName+".auto_id ADD COLUMN after_sync INT"); err != nil {
			t.Fatal(err)
		}
		exec(from, "ALTER TABLE "+sourceName+".auto_id DROP COLUMN after_sync")
	})

	t.Run("overlapping jobs and mid-copy cancellation", func(t *testing.T) {
		config := input
		config.TargetDatabase = stem + "_partial"
		parallel := input
		parallel.TargetDatabase = stem + "_parallel"
		cleanup(to, config.TargetDatabase)
		cleanup(to, parallel.TargetDatabase)
		jobCtx, cancel := context.WithCancel(ctx)
		defer cancel()
		err := svc.Run(jobCtx, config, func(p model.DatabaseSyncProgress) error {
			if p.Rows == 128 {
				err := svc.Run(ctx, parallel, func(model.DatabaseSyncProgress) error { return nil })
				if !errors.Is(err, databasesync.ErrBusy) {
					t.Errorf("parallel job should be rejected: %v", err)
				}
				cancel()
			}
			return jobCtx.Err()
		})
		if !errors.Is(err, context.Canceled) || exists(parallel.TargetDatabase) != 0 {
			t.Fatalf("unexpected state after cancel: %v", err)
		}
		if n := count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".auto_id"); n != 128 {
			t.Fatalf("expected 128 committed rows, got %d", n)
		}
		if n := count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".parent"); n != 0 {
			t.Fatalf("later table contains %d unexpected rows", n)
		}
		if res := request("run", parallel); !strings.Contains(res.Body.String(), `"type":"done"`) {
			t.Fatalf("next run failed: %s", res.Body)
		}
	})

	t.Run("two independent services race for the target", func(t *testing.T) {
		config := input
		config.TargetDatabase = stem + "_competition"
		cleanup(to, config.TargetDatabase)
		if _, err := svc.Check(ctx, config); err != nil {
			t.Fatal(err)
		}
		ready := make(chan struct{}, 2)
		start := make(chan struct{})
		results := make(chan error, 2)
		for _, service := range []*databasesync.Service{svc, databasesync.New(store, map[string]databasesync.Engine{model.TypeMySQL: mysql.NewClient()})} {
			go func() {
				results <- service.Run(ctx, config, func(p model.DatabaseSyncProgress) error {
					if p.Phase == "checking" {
						ready <- struct{}{}
						<-start
					}
					return nil
				})
			}()
		}
		for range 2 {
			select {
			case <-ready:
			case err := <-results:
				close(start)
				t.Fatalf("sync failed before race: %v", err)
			case <-ctx.Done():
				close(start)
				t.Fatal(ctx.Err())
			}
		}
		close(start)
		var succeeded, stopped int
		for range 2 {
			err := <-results
			switch {
			case err == nil:
				succeeded++
			case strings.Contains(err.Error(), "目标数据库已存在"):
				stopped++
			default:
				t.Error(err)
			}
		}
		if succeeded != 1 || stopped != 1 || count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".auto_id") != 300 {
			t.Fatalf("expected exactly one successful copy: succeeded=%d stopped=%d", succeeded, stopped)
		}
	})

	t.Run("target user permissions and hidden existing schema", func(t *testing.T) {
		user := "'" + stem + "'@'%'"
		exec(to, "CREATE USER "+user+" IDENTIFIED BY 'fixture-account-password'")
		t.Cleanup(func() { exec(to, "DROP USER "+user) })
		limited := target
		limited.Username, limited.Password = stem, "fixture-account-password"
		config := input
		config.TargetConnectionID = save(limited)
		config.TargetDatabase = stem + "_denied"
		cleanup(to, config.TargetDatabase)
		if res := request("run", config); !strings.Contains(res.Body.String(), `"type":"error"`) || strings.Contains(res.Body.String(), `"type":"done"`) || exists(config.TargetDatabase) != 0 {
			t.Fatalf("write without permission: %s", res.Body)
		}
		exec(to, "CREATE DATABASE "+config.TargetDatabase)
		exec(to, "CREATE TABLE "+config.TargetDatabase+".sentinel (id INT)")
		if res := request("run", config); !strings.Contains(res.Body.String(), `"type":"error"`) || count(to, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=?", config.TargetDatabase) != 1 {
			t.Fatalf("hidden target was modified: %s", res.Body)
		}
		config.TargetDatabase = stem + "_writer"
		cleanup(to, config.TargetDatabase)
		grant := " ON `" + strings.ReplaceAll(config.TargetDatabase, "_", `\_`) + "`.* TO " + user
		exec(to, "GRANT CREATE"+grant)
		res := request("run", config)
		if !strings.Contains(res.Body.String(), `"type":"error"`) || exists(config.TargetDatabase) != 1 || count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".auto_id") != 0 {
			t.Fatalf("CREATE-only account wrote records or reported success: %s", res.Body)
		}
		config.TargetDatabase = stem + "_writer_ok"
		cleanup(to, config.TargetDatabase)
		grant = " ON `" + strings.ReplaceAll(config.TargetDatabase, "_", `\_`) + "`.* TO " + user
		exec(to, "GRANT CREATE, INSERT, REFERENCES"+grant)
		if res := request("run", config); !strings.Contains(res.Body.String(), `"type":"done"`) || count(to, "SELECT COUNT(*) FROM "+config.TargetDatabase+".auto_id") != 300 {
			t.Fatalf("limited write account could not sync: %s", res.Body)
		}
	})

	t.Run("cross database foreign key and missing source never write", func(t *testing.T) {
		config := input
		config.TargetDatabase = stem + "_dependent_target"
		cleanup(to, config.TargetDatabase)
		external := stem + "_external"
		exec(from, "CREATE DATABASE "+external)
		cleanup(from, external)
		exec(from, "CREATE TABLE "+external+".parents (id INT PRIMARY KEY)")
		exec(from, "CREATE TABLE "+sourceName+".external_child (id INT PRIMARY KEY, parent INT, FOREIGN KEY (parent) REFERENCES "+external+".parents(id))")
		if res := request("check", config); !strings.Contains(res.Body.String(), "跨库外键") || exists(config.TargetDatabase) != 0 {
			t.Fatalf("cross database not rejected: %s", res.Body)
		}
		exec(from, "DROP TABLE "+sourceName+".external_child")
		config.SourceDatabase = stem + "_absent"
		if res := request("run", config); !strings.Contains(res.Body.String(), `"type":"error"`) || exists(config.TargetDatabase) != 0 {
			t.Fatalf("missing source not rejected: %s", res.Body)
		}
	})

	t.Run("super read only target rejected before start", func(t *testing.T) {
		exec(to, "SET GLOBAL super_read_only=1")
		defer exec(to, "SET GLOBAL read_only=0")
		config := input
		config.TargetDatabase = stem + "_read_only"
		cleanup(to, config.TargetDatabase)
		for _, method := range []string{"check", "run"} {
			if res := request(method, config); !strings.Contains(res.Body.String(), "强制只读模式") || exists(config.TargetDatabase) != 0 {
				t.Fatalf("%s did not refuse super read only: %s", method, res.Body)
			}
		}
	})

	t.Run("wide rows and byte-bounded batches", func(t *testing.T) {
		bulkSource := stem + "_bulk"
		cleanup(from, bulkSource)
		exec(from, "CREATE DATABASE "+bulkSource)
		exec(from, "CREATE TABLE "+bulkSource+".chunks (id INT PRIMARY KEY, payload MEDIUMBLOB)")
		exec(from, "INSERT INTO "+bulkSource+".chunks WITH RECURSIVE n AS (SELECT 1 AS id UNION ALL SELECT id+1 FROM n WHERE id<100) SELECT id, REPEAT(UNHEX(LPAD(HEX(id), 2, '0')), 262144) FROM n")
		exec(from, "INSERT INTO "+bulkSource+".chunks VALUES (0, REPEAT(X'00FF', 3 * 1024 * 1024))")
		config := input
		config.SourceDatabase, config.TargetDatabase = bulkSource, stem+"_bulk_target"
		cleanup(to, config.TargetDatabase)
		var progress model.DatabaseSyncProgress
		if err := svc.Run(ctx, config, func(p model.DatabaseSyncProgress) error { progress = p; return nil }); err != nil || progress.Rows != 101 {
			t.Fatalf("copy failed: rows=%d, err=%v", progress.Rows, err)
		}
		rows, err := from.QueryContext(ctx, "SELECT id, LENGTH(payload), SHA2(payload,256) FROM "+bulkSource+".chunks ORDER BY id")
		if err != nil {
			t.Fatal(err)
		}
		defer rows.Close()
		copied, err := to.QueryContext(ctx, "SELECT id, LENGTH(payload), SHA2(payload,256) FROM "+config.TargetDatabase+".chunks ORDER BY id")
		if err != nil {
			t.Fatal(err)
		}
		defer copied.Close()
		var verified int
		for rows.Next() {
			var id, length, targetID, targetLength int
			var sha, targetSHA string
			if err := rows.Scan(&id, &length, &sha); err != nil {
				t.Fatal(err)
			}
			if !copied.Next() {
				t.Fatal("target rows ended early")
			}
			if err := copied.Scan(&targetID, &targetLength, &targetSHA); err != nil {
				t.Fatal(err)
			}
			if id != targetID || length != targetLength || sha != targetSHA {
				t.Fatalf("data differs at row %d", id)
			}
			verified++
		}
		if verified != 101 || copied.Next() || rows.Err() != nil || copied.Err() != nil {
			t.Fatal("incomplete row verification")
		}
		exec(from, "INSERT INTO "+bulkSource+".chunks VALUES (-1, REPEAT(X'00', 9 * 1024 * 1024))")
		config.TargetDatabase = stem + "_too_wide"
		cleanup(to, config.TargetDatabase)
		if res := request("run", config); !strings.Contains(res.Body.String(), "超过同步单行大小限制") || strings.Contains(res.Body.String(), `"type":"done"`) {
			t.Fatalf("oversized row not rejected: %s", res.Body)
		}
	})

	stopped := input
	stopped.TargetDatabase = stem + "_cancel"
	cleanup(to, stopped.TargetDatabase)
	stopCtx, stop := context.WithCancel(ctx)
	defer stop()
	err = svc.Run(stopCtx, stopped, func(p model.DatabaseSyncProgress) error {
		if p.Phase == "created" {
			stop()
		}
		return stopCtx.Err()
	})
	if err == nil || exists(stopped.TargetDatabase) != 1 || count(to, "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=?", stopped.TargetDatabase) != 0 {
		t.Fatalf("cancellation did not stop before creating tables: %v", err)
	}
}
