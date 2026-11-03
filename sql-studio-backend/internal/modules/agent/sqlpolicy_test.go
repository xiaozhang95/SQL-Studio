package chat

import (
	"context"
	"encoding/json"
	"reflect"
	model "sql-studio-backend/internal/model/agent"
	"testing"
)

func TestAgentReadPolicyRejectsBeforeDatabase(t *testing.T) {
	for _, sql := range []string{"USE other", "SELECT GET_LOCK('fixture', 1)", "SELECT * FROM other.secret", "SELECT 1; SELECT 2", "SELECT pg_catalog.lo_unlink(42)", "SELECT cleanup_fixture()", "SELECT * FROM cleanup_fixture()"} {
		t.Run(sql, func(t *testing.T) {
			db := &fakeDB{}
			s := New(nil, db)
			state := toolState{target: model.Target{ConnectionID: "a", Database: "demo"}, connections: []model.Connection{{ID: "a", Type: "mysql"}}}
			args, _ := json.Marshal(map[string]string{"sql": sql})
			_, err := s.execute(context.Background(), &state, call("query_readonly", string(args)).ToolCalls[0])
			if err == nil || db.calls != 0 {
				t.Fatalf("unsafe read reached database: calls=%d error=%v", db.calls, err)
			}
		})
	}
}

func TestApprovalObjectsIncludesSourcesAndIgnoresLiteralSQL(t *testing.T) {
	for _, c := range []struct {
		sql  string
		want []string
	}{
		{`UPDATE "public"."items" SET label='UPDATE fake SET n=1' WHERE id IN (SELECT id FROM "public"."source")`, []string{`"public"."items"`, `"public"."source"`}},
		{"INSERT INTO target(id) SELECT id FROM source", []string{"target", "source"}},
		{"CREATE INDEX idx ON items(id)", []string{"idx", "items"}},
		{"CREATE TABLE IF NOT EXISTS items (id INT)", []string{"items"}},
	} {
		if got := approvalObjects(c.sql); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s: got %v want %v", c.sql, got, c.want)
		}
	}
}

func TestAgentReadPolicyKeepsQueriesAndScope(t *testing.T) {
	for _, engine := range []string{"mysql", "mariadb", "postgresql"} {
		for _, sql := range []string{
			"SELECT COUNT(*) AS n, MAX(id) FROM items",
			"SELECT i.id, COALESCE(i.label, 'unknown') FROM items AS i WHERE i.id > 0 ORDER BY i.id LIMIT 100",
			"SELECT q.id FROM (SELECT id FROM items) q",
			"WITH q AS (SELECT id FROM items) SELECT q.id FROM q",
			"WITH q(id) AS (SELECT id FROM items), z(n) AS (SELECT 1) SELECT q.id FROM q",
			"SELECT CAST(12.34 AS DECIMAL(20,4)), 'DELETE; DROP /* literal */'",
		} {
			if err := ValidateReadSQL(sql, engine, "demo"); err != nil {
				t.Errorf("%s rejected valid query %s: %v", engine, sql, err)
			}
		}
	}
	for _, sql := range []string{"SELECT d.id FROM demo.items d", "SELECT demo.items.id FROM demo.items", "SELECT * FROM `demo`.`items`"} {
		if err := ValidateReadSQL(sql, "mysql", "demo"); err != nil {
			t.Fatal(sql, err)
		}
	}
	for _, sql := range []string{"SELECT other.items.id FROM demo.items", "SELECT * FROM items AS other, other.secret", "SELECT * FROM items a JOIN other.secret s ON a.id=s.id", "SELECT * FROM (SELECT * FROM other.secret) q", "SELECT * FROM `other`.`secret`"} {
		if ValidateReadSQL(sql, "mysql", "demo") == nil {
			t.Error("cross-database query allowed:", sql)
		}
	}
	for _, sql := range []string{`SELECT "i"."id" FROM "public"."items" AS "i"`, "SELECT * FROM pg_catalog.generate_series(1,3)"} {
		if err := ValidateReadSQL(sql, "postgresql", "demo"); err != nil {
			t.Fatal(sql, err)
		}
	}
}

func TestAgentRejectsUnsafeSQLForms(t *testing.T) {
	for _, sql := range []string{
		"SELECT SLEEP(1)", "SELECT pg_sleep(1)", "SELECT * FROM dblink('fixture','SELECT 1')", "SELECT app.lower('x')",
		"SELECT 1 INTO OUTFILE '/fixture'", "SELECT * FROM items FOR UPDATE", "SELECT * FROM items LOCK IN SHARE MODE",
		"SELECT pg_read_file('/fixture')", "SELECT pg_terminate_backend(1)", "SELECT setval('seq',1)", "SELECT load_file('/fixture')",
		"SELECT 1; SELECT 2", "/*! SELECT 1 */", "SELECT 'unterminated", "SELECT $$program$$", "SELECT @x:=1", "SELECT (1",
	} {
		if ValidateReadSQL(sql, "postgresql", "demo") == nil {
			t.Error("unsafe read allowed:", sql)
		}
	}
	for _, sql := range []string{
		"INSERT INTO items(id) SELECT id FROM other.items", "UPDATE other.items SET label='x'", "UPDATE items a, other.items b SET a.id=b.id",
		"CREATE TABLE other.items (id INT)", "CREATE VIEW current_items AS SELECT * FROM other.items",
	} {
		if ValidateSQLScope(sql, "mysql", "demo") == nil {
			t.Error("cross-database write allowed:", sql)
		}
	}
	for _, sql := range []string{
		"INSERT INTO items(id) VALUES(1) ON CONFLICT(id) DO UPDATE SET id=2",
		"INSERT INTO items(id) VALUES(1) ON CONFLICT(id) DO NOTHING",
		"UPDATE items SET label=LOWER(label), amount=amount+1 WHERE id IN (SELECT id FROM items)",
		"CREATE TABLE items (id BIGINT PRIMARY KEY, label VARCHAR(100), amount DECIMAL(20,4))",
	} {
		if err := ValidateWriteSQL(sql); err != nil {
			t.Error("non-delete operation rejected:", sql, err)
		}
	}
}

func TestAgentWritePolicyRejectsIndirectSideEffects(t *testing.T) {
	for _, sql := range []string{"INSERT INTO t(n) SELECT lo_unlink(42)", "UPDATE t SET n=cleanup_fixture()", "CREATE TABLE t AS SELECT pg_catalog.pg_read_file('/fixture')", "INSERT INTO t(n) SELECT SLEEP(10)", "ALTER TABLE t DISCARD TABLESPACE", "ALTER TABLE t DETACH PARTITION p", "CREATE USER someone", "ALTER SYSTEM SET shared_preload_libraries='fixture'", "CREATE EXTENSION fixture"} {
		if ValidateWriteSQL(sql) == nil {
			t.Errorf("unsafe write accepted: %s", sql)
		}
	}
}
