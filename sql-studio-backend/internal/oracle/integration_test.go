package oracle

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/model"
)

// Opt in only with an isolated database. The random test objects are scoped
// to the disposable Oracle instance.
func TestOracleIntegration(t *testing.T) {
	password := os.Getenv("SQLSTUDIO_ORACLE_TEST_PASSWORD")
	if password == "" {
		t.Skip("requires a disposable Oracle instance")
	}
	port, err := strconv.Atoi(os.Getenv("SQLSTUDIO_ORACLE_TEST_PORT"))
	if err != nil {
		t.Fatal(err)
	}
	connection := model.Connection{ID: "oracle-integration", Type: model.TypeOracle, Database: defaultService,
		Host: "127.0.0.1", Port: port, Username: "SQLSTUDIO", Password: password}
	if user := os.Getenv("SQLSTUDIO_ORACLE_TEST_USER"); user != "" {
		connection.Username = user
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	client := NewClient()
	if version, err := client.Test(ctx, connection); err != nil || version == "" {
		t.Fatalf("connection test: %q, %v", version, err)
	}
	schemas, err := client.Schemas(ctx, connection, defaultService)
	if err != nil || len(schemas) != 1 || schemas[0] != connection.Username {
		t.Fatalf("schemas: %v, %v", schemas, err)
	}
	var random [5]byte
	rand.Read(random[:])
	name := "Demo." + hex.EncodeToString(random[:])
	owner := quoteIdentifier(connection.Username)
	ref := model.TableRef{Database: defaultService, Name: owner + "." + quoteIdentifier(name)}
	child := owner + "." + quoteIdentifier(name+" child")
	view := owner + "." + quoteIdentifier(name+" view")
	query := func(statement string, write bool) (model.QueryResult, error) {
		return client.Execute(ctx, connection, model.QueryRequest{Database: defaultService, Schema: connection.Username, SQL: statement, Limit: 10, AllowWrite: write})
	}
	write := func(statements ...string) {
		t.Helper()
		for _, statement := range statements {
			if _, err := query(statement, true); err != nil {
				t.Fatalf("execute %s: %v", statement, err)
			}
		}
	}
	write("CREATE TABLE "+ref.Name+" (ID NUMBER(38) PRIMARY KEY, AMOUNT NUMBER(32,10) DEFAULT 0, STAMP DATE, PAYLOAD RAW(8), NOTE CLOB, VIRTUAL_COL GENERATED ALWAYS AS (AMOUNT+1) VIRTUAL, BINARY_VALUE BLOB, GEN_ID NUMBER GENERATED ALWAYS AS IDENTITY)",
		"CREATE INDEX "+quoteIdentifier(name+" IDX")+" ON "+ref.Name+" (AMOUNT DESC)",
		"CREATE TABLE "+child+" (ID NUMBER REFERENCES "+ref.Name+" (ID))",
		"CREATE VIEW "+view+" AS SELECT ID FROM "+ref.Name,
		"COMMENT ON TABLE "+view+" IS 'a view'",
		"COMMENT ON COLUMN "+ref.Name+".AMOUNT IS 'amount'",
		"INSERT INTO "+ref.Name+" (ID,AMOUNT,STAMP,PAYLOAD,NOTE,BINARY_VALUE) VALUES (98765432109876543210987654321098765432,12345678901234567890.123456789,TO_DATE('2026-11-26 10:20:30','YYYY-MM-DD HH24:MI:SS'),HEXTORAW('CAFE'),'demo',TO_BLOB(HEXTORAW('00FF')))")
	rows, err := query("SELECT ID, AMOUNT, STAMP, PAYLOAD, NOTE, NULL AS EMPTY, BINARY_VALUE FROM "+quoteIdentifier(name)+";", false)
	if err != nil || len(rows.Rows) != 1 {
		t.Fatalf("select: %#v, %v", rows, err)
	}
	want := []any{"98765432109876543210987654321098765432", "12345678901234567890.123456789", "2026-11-26 10:20:30", "0xcafe", "demo", nil, "0x00ff"}
	for i, value := range want {
		if rows.Rows[0][i] != value {
			t.Errorf("column %d got %#v (%s), want %#v", i, rows.Rows[0][i], rows.Columns[i].Type, value)
		}
	}
	if _, err := query("SELECT 1 FROM DUAL", false); err != nil {
		t.Fatalf("read-only transaction: %v", err)
	}
	list, err := client.Tables(ctx, connection, defaultService)
	found := false
	for _, item := range list {
		found = found || item.Name == ref.Name && item.Type == "TABLE"
	}
	if err != nil || !found {
		t.Fatalf("table not listed: %v", err)
	}
	columns, err := client.Columns(ctx, connection, ref)
	if err != nil || len(columns) != 8 || columns[0].Key != "PRI" || columns[1].Default == nil || *columns[1].Default != "0" || columns[1].Comment != "amount" ||
		columns[7].Extra != "GENERATED ALWAYS AS IDENTITY" {
		t.Fatalf("columns: %+v, %v", columns, err)
	}
	indexes, err := client.Indexes(ctx, connection, ref)
	if err != nil || len(indexes) < 2 {
		t.Fatalf("indexes: %+v, %v", indexes, err)
	}
	keys, err := client.ForeignKeys(ctx, connection, model.TableRef{Database: defaultService, Name: child})
	if err != nil || len(keys) != 1 || keys[0].ReferencedTable != name || keys[0].Columns[0].ReferencedName != "ID" {
		t.Fatalf("foreign keys: %+v, %v", keys, err)
	}
	ddl, err := client.DDL(ctx, connection, ref)
	if err != nil || !strings.Contains(ddl, "CREATE TABLE") || !strings.Contains(ddl, "CREATE INDEX") || !strings.Contains(ddl, "COMMENT ON COLUMN") {
		t.Fatalf("DDL: %q, %v", ddl, err)
	}
	ddl, err = client.DDL(ctx, connection, model.TableRef{Database: defaultService, Name: view})
	if err != nil || !strings.Contains(ddl, " VIEW ") || !strings.Contains(ddl, "COMMENT ON TABLE") {
		t.Fatalf("view DDL: %q, %v", ddl, err)
	}
	count := 0
	err = client.StreamTableData(ctx, connection, ref, func(result model.QueryResult) error {
		count += result.RowCount
		return nil
	})
	if err != nil || count != 1 {
		t.Fatalf("streamed %d rows: %v", count, err)
	}
	monitor, err := client.Monitor(ctx, connection, defaultService)
	if err != nil || len(monitor.Metrics) < 4 {
		t.Fatalf("monitor: %#v, %v", monitor, err)
	}
	if _, err := query("UPDATE "+ref.Name+" SET AMOUNT=4", false); err == nil {
		t.Fatal("default read-only API allowed update")
	}
	if _, err := query("SELECT 1 FROM DUAL; SELECT 2 FROM DUAL", true); err == nil {
		t.Fatal("single statement API accepted a script")
	}
	var steps []model.QueryBatchStep
	batch := func(statements ...string) error {
		steps = nil
		return client.ExecuteBatch(ctx, connection, model.QueryBatchRequest{Database: defaultService, Schema: connection.Username, Statements: statements, Limit: 10, AllowWrite: true}, 15*time.Second, func(step model.QueryBatchStep) error {
			steps = append(steps, step)
			return nil
		})
	}
	err = batch("BEGIN NULL; END;", "INSERT INTO "+ref.Name+" (ID) VALUES (2)", "SAVEPOINT before_update", "UPDATE "+ref.Name+" SET AMOUNT=3 WHERE ID=2", "ROLLBACK TO before_update", "COMMIT", "SELECT AMOUNT FROM "+ref.Name+" WHERE ID=2")
	if err != nil || len(steps) != 7 || steps[6].Result == nil || steps[6].Result.Rows[0][0] != "0" {
		t.Fatalf("transaction batch: %+v, %v", steps, err)
	}
	err = batch("SELECT 1 FROM DUAL", "SELECT missing FROM DUAL", "SELECT 3 FROM DUAL")
	if err != nil || len(steps) != 2 || !steps[1].StatementError {
		t.Fatalf("failed batch: %+v, %v", steps, err)
	}
	if err = batch("INSERT INTO "+ref.Name+" (ID) VALUES (3)", "SELECT missing FROM DUAL", "COMMIT"); err != nil || len(steps) != 2 {
		t.Fatalf("rollback after failed step: %+v, %v", steps, err)
	}
	check, err := query("SELECT COUNT(*) FROM "+ref.Name+" WHERE ID=3", false)
	if err != nil || len(check.Rows) != 1 || check.Rows[0][0] != "0" {
		t.Fatalf("rollback: %+v, %v", check, err)
	}
	cancelCtx, stop := context.WithTimeout(ctx, 500*time.Millisecond)
	defer stop()
	start := time.Now()
	_, err = client.Execute(cancelCtx, connection, model.QueryRequest{SQL: "BEGIN DBMS_SESSION.SLEEP(10); END;", AllowWrite: true, Limit: 10})
	if err == nil || time.Since(start) > 5*time.Second {
		t.Fatalf("cancel was not propagated within five seconds: %v in %s", err, time.Since(start))
	}
	if targetUser := os.Getenv("SQLSTUDIO_ORACLE_SYNC_TARGET"); targetUser != "" {
		target := connection
		target.ID, target.Username = "oracle-sync-target", targetUser
		request := model.DatabaseSyncRequest{SourceDatabase: connection.Username, TargetDatabase: targetUser, Structure: true, Data: true}
		plan, err := client.CheckDatabaseSync(ctx, connection, target, request)
		if err != nil || plan.Tables != 2 || plan.SkippedViews != 1 || !plan.ExistingTarget {
			t.Fatalf("sync check: %+v, %v", plan, err)
		}
		var progress model.DatabaseSyncProgress
		err = client.SyncDatabase(ctx, connection, target, request, func(item model.DatabaseSyncProgress) error {
			progress = item
			return nil
		})
		if err != nil || progress.Completed != 2 || progress.Rows != 2 || !progress.ExistingTarget {
			t.Fatalf("sync run: %+v, %v", progress, err)
		}
		copied, err := client.Execute(ctx, target, model.QueryRequest{SQL: "SELECT ID, AMOUNT, STAMP, PAYLOAD, NOTE, NULL AS EMPTY, BINARY_VALUE FROM " +
			quoteIdentifier(name) + " WHERE ID>2", Limit: 10})
		if err != nil || len(copied.Rows) != 1 {
			t.Fatalf("synced row: %+v, %v", copied, err)
		}
		for i, value := range want {
			if copied.Rows[0][i] != value {
				t.Errorf("copied column %d got %#v, want %#v", i, copied.Rows[0][i], value)
			}
		}
		if _, err = client.CheckDatabaseSync(ctx, connection, target, request); err == nil {
			t.Fatal("sync accepted a destination that already contained objects")
		}
		if _, err = client.Execute(ctx, target, model.QueryRequest{SQL: "INSERT INTO " + quoteIdentifier(name) + " (ID) VALUES (4)", Limit: 10, AllowWrite: true}); err != nil {
			t.Fatalf("insert with synced identity: %v", err)
		}
		targetTable := quoteIdentifier(name)
		identity, err := client.Execute(ctx, target, model.QueryRequest{
			SQL: "SELECT COUNT(*) FROM " + targetTable + " WHERE ID=4 AND GEN_ID > (SELECT MAX(GEN_ID) FROM " + targetTable + " WHERE ID<>4)", Limit: 10,
		})
		if err != nil || len(identity.Rows) != 1 || identity.Rows[0][0] != "1" {
			t.Fatalf("synced identity was not advanced: %+v, %v", identity.Rows, err)
		}
	}
}
