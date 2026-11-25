package mysql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"reflect"
	"sync"
	"testing"

	mysqlDriver "github.com/go-sql-driver/mysql"

	"sql-studio-backend/internal/model"
)

func TestClassifyMySQLAndMariaDBCheckErrors(t *testing.T) {
	client := NewClient()
	for _, number := range []uint16{3819, 4025} {
		err := &mysqlDriver.MySQLError{Number: number, Message: "private constraint details"}
		if kind := client.ClassifyQueryError(err); kind != model.QueryErrorCheck {
			t.Errorf("error %d classified as %q", number, kind)
		}
	}
}

func TestStatementErrorScope(t *testing.T) {
	for _, example := range []struct {
		number    uint16
		statement bool
	}{
		{1146, true}, {1064, true}, {1062, true}, {1049, false}, {1045, false}, {1153, false},
	} {
		err := &mysqlDriver.MySQLError{Number: example.number, Message: "driver failure"}
		result := queryError(err)
		if !errors.Is(result, err) || model.IsStatementError(result) != example.statement {
			t.Errorf("error %d classified incorrectly: %v", example.number, result)
		}
	}
}

// 使用 database/sql 的真实扫描和事务流程，替换网络驱动，不访问 MySQL 实例。
type queryFixture struct {
	columns, types   []string
	rows             [][]driver.Value
	queryError       error
	queryRows        func(string, []driver.NamedValue) (driver.Rows, error)
	rowError         error
	mu               sync.Mutex
	readOnly         bool
	rolledBack       bool
	rowsClosed       bool
	executed         bool
	connectionClosed bool
}

type fixtureConnector struct{ fixture *queryFixture }
type fixtureDriver struct{}
type fixtureConn struct{ fixture *queryFixture }
type fixtureTx struct{ fixture *queryFixture }
type fixtureRows struct {
	fixture *queryFixture
	index   int
}
type fixtureResult struct{}

func (fixtureDriver) Open(string) (driver.Conn, error) { return nil, errors.New("use connector") }
func (c fixtureConnector) Driver() driver.Driver       { return fixtureDriver{} }
func (c fixtureConnector) Connect(context.Context) (driver.Conn, error) {
	return fixtureConn{c.fixture}, nil
}
func (fixtureConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("unexpected prepare") }
func (c fixtureConn) Close() error {
	c.fixture.mu.Lock()
	c.fixture.connectionClosed = true
	c.fixture.mu.Unlock()
	return nil
}
func (c fixtureConn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}
func (c fixtureConn) BeginTx(_ context.Context, options driver.TxOptions) (driver.Tx, error) {
	c.fixture.mu.Lock()
	c.fixture.readOnly = options.ReadOnly
	c.fixture.mu.Unlock()
	return fixtureTx{c.fixture}, nil
}
func (c fixtureConn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if c.fixture.queryError != nil {
		return nil, c.fixture.queryError
	}
	if c.fixture.queryRows != nil {
		return c.fixture.queryRows(query, args)
	}
	return &fixtureRows{fixture: c.fixture}, nil
}
func (c fixtureConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	c.fixture.mu.Lock()
	c.fixture.executed = true
	c.fixture.mu.Unlock()
	return fixtureResult{}, nil
}
func (fixtureTx) Commit() error { return nil }
func (tx fixtureTx) Rollback() error {
	tx.fixture.mu.Lock()
	tx.fixture.rolledBack = true
	tx.fixture.mu.Unlock()
	return nil
}
func (r *fixtureRows) Columns() []string                           { return r.fixture.columns }
func (r *fixtureRows) ColumnTypeDatabaseTypeName(index int) string { return r.fixture.types[index] }
func (r *fixtureRows) Close() error {
	r.fixture.mu.Lock()
	r.fixture.rowsClosed = true
	r.fixture.mu.Unlock()
	return nil
}
func (r *fixtureRows) Next(values []driver.Value) error {
	if r.index >= len(r.fixture.rows) {
		if r.fixture.rowError != nil {
			return r.fixture.rowError
		}
		return io.EOF
	}
	copy(values, r.fixture.rows[r.index])
	r.index++
	return nil
}
func (fixtureResult) LastInsertId() (int64, error) { return 9007199254740993, nil }
func (fixtureResult) RowsAffected() (int64, error) { return 2, nil }

type fixtureResultSets struct {
	fixtureRows
	remaining []*queryFixture
}

func (r *fixtureResultSets) HasNextResultSet() bool { return len(r.remaining) > 0 }
func (r *fixtureResultSets) NextResultSet() error {
	if !r.HasNextResultSet() {
		return io.EOF
	}
	r.fixtureRows = fixtureRows{fixture: r.remaining[0]}
	r.remaining = r.remaining[1:]
	return nil
}

func fixtureDB(t *testing.T, fixture *queryFixture) *sql.DB {
	t.Helper()
	db := sql.OpenDB(fixtureConnector{fixture})
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestQueryResultFidelity(t *testing.T) {
	f := &queryFixture{
		columns: []string{"id", "id", "amount", "payload", "nullable"},
		types:   []string{"BIGINT", "BIGINT", "DECIMAL", "BLOB", "VARCHAR"},
		rows:    [][]driver.Value{{int64(9007199254740993), uint64(18446744073709551615), []byte("12.3400"), []byte{0, 255}, nil}},
	}
	result, err := execute(context.Background(), fixtureDB(t, f), "SELECT fixture", 1000, false)
	if err != nil {
		t.Fatal(err)
	}
	want := [][]any{{"9007199254740993", "18446744073709551615", "12.3400", "0x00ff", nil}}
	if !reflect.DeepEqual(result.Rows, want) || result.RowCount != 1 || !result.IsQuery || result.Truncated {
		t.Fatalf("result fidelity changed: %+v", result)
	}
	if len(result.Columns) != 5 || result.Columns[0].Name != result.Columns[1].Name {
		t.Fatal("duplicate aliases lost")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.readOnly || !f.rowsClosed || !f.rolledBack {
		t.Fatal("read-only transaction or cursor lifecycle missing")
	}
}

func TestQueryResultBounds(t *testing.T) {
	manyRows := make([][]driver.Value, 5001)
	for i := range manyRows {
		manyRows[i] = []driver.Value{""}
	}
	for _, test := range []struct {
		name            string
		rows            [][]driver.Value
		limit, wantRows int
		truncated       bool
	}{
		{"row limit", [][]driver.Value{{[]byte("a")}, {[]byte("b")}}, 1, 1, true},
		{"exact limit", [][]driver.Value{{[]byte("a")}}, 1, 1, false},
		{"no row limit", manyRows, model.UnlimitedQueryRows, len(manyRows), false},
		{"byte limit", [][]driver.Value{{make([]byte, maxResultBytes+1)}}, 1000, 0, true},
		{"byte limit without row limit", [][]driver.Value{{[]byte("kept")}, {make([]byte, maxResultBytes)}}, model.UnlimitedQueryRows, 1, true},
		{"retain complete rows within byte limit", [][]driver.Value{{[]byte("kept")}, {make([]byte, maxResultBytes)}}, 1000, 1, true},
		{"empty", nil, 1000, 0, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := &queryFixture{columns: []string{"value"}, types: []string{"VARCHAR"}, rows: test.rows}
			result, err := execute(context.Background(), fixtureDB(t, f), "SELECT fixture", test.limit, false)
			if err != nil {
				t.Fatal(err)
			}
			if result.RowCount != test.wantRows || result.Truncated != test.truncated {
				t.Fatalf("unexpected bound: %+v", result)
			}
			if test.name == "byte limit" && (len(result.RowPreview) != 1 || !result.RowPreview[0].Shortened) {
				t.Fatalf("oversized row has no bounded preview: %+v", result)
			}
			f.mu.Lock()
			defer f.mu.Unlock()
			if !f.rowsClosed {
				t.Fatal("cursor was not closed")
			}
		})
	}
}

func TestQueryErrorsAndCancellation(t *testing.T) {
	sentinel := errors.New("fixture read failed")
	for _, test := range []struct {
		name                 string
		queryError, rowError error
	}{
		{"query", sentinel, nil}, {"rows", nil, sentinel},
	} {
		t.Run(test.name, func(t *testing.T) {
			f := &queryFixture{columns: []string{"value"}, types: []string{"VARCHAR"}, queryError: test.queryError, rowError: test.rowError}
			_, err := execute(context.Background(), fixtureDB(t, f), "SELECT fixture", 1000, false)
			if !errors.Is(err, sentinel) {
				t.Fatalf("database error lost: %v", err)
			}
			f.mu.Lock()
			defer f.mu.Unlock()
			if !f.rolledBack {
				t.Fatal("failed read-only transaction was not closed")
			}
		})
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := execute(ctx, fixtureDB(t, &queryFixture{}), "SELECT fixture", 1000, false)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation lost: %v", err)
	}
}

func TestWriteFeedbackPreservesInsertID(t *testing.T) {
	f := &queryFixture{}
	result, err := execute(context.Background(), fixtureDB(t, f), "INSERT INTO fixture VALUES (1)", 1000, true)
	if err != nil {
		t.Fatal(err)
	}
	if result.IsQuery || result.AffectedRows != 2 || result.LastInsertID != "9007199254740993" {
		t.Fatalf("write feedback changed: %+v", result)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if !f.executed {
		t.Fatal("explicit write did not use execution path")
	}
}

func TestUnsafeReadOnlyStatementsAreRejectedBeforeDatabaseAccess(t *testing.T) {
	for _, statement := range []string{"CREATE TABLE blocked (id INT)", "DROP TABLE sample", "/*!80000 CREATE TABLE blocked AS */ SELECT 1", "CALL fixture()", "EXECUTE fixture"} {
		// A nil DB proves rejection happens before beginning a transaction or sending SQL.
		if _, err := execute(context.Background(), nil, statement, 1000, false); err == nil {
			t.Fatalf("read-only statement reached the database: %s", statement)
		}
	}
}

func TestCallAndExecuteReadMultipleResults(t *testing.T) {
	for _, statement := range []string{"CALL fixture()", "EXECUTE fixture"} {
		t.Run(statement, func(t *testing.T) {
			first := &queryFixture{columns: []string{"first"}, types: []string{"BIGINT"}, rows: [][]driver.Value{{int64(42)}}}
			second := &queryFixture{columns: []string{"second"}, types: []string{"VARCHAR"}, rows: [][]driver.Value{{"data"}}}
			invocations := 0
			first.queryRows = func(string, []driver.NamedValue) (driver.Rows, error) {
				invocations++
				return &fixtureResultSets{fixtureRows: fixtureRows{fixture: first}, remaining: []*queryFixture{second}}, nil
			}
			db := fixtureDB(t, first)
			result, err := execute(context.Background(), db, statement, 2, true)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(result.Rows, [][]any{{"42"}}) || len(result.AdditionalResults) != 1 ||
				!reflect.DeepEqual(result.AdditionalResults[0].Rows, [][]any{{"data"}}) {
				t.Fatalf("unexpected result sets: %+v", result)
			}

			result, err = execute(context.Background(), db, statement, 1, true)
			if err != nil {
				t.Fatal(err)
			}
			if len(result.AdditionalResults) != 1 || result.AdditionalResults[0].RowCount != 0 || result.AdditionalResults[0].TruncatedBy != model.QueryRowLimit {
				t.Fatalf("expected a shared row limit: %+v", result)
			}
			if invocations != 2 || first.executed {
				t.Fatalf("expected one driver operation per request, got %d queries, exec=%t", invocations, first.executed)
			}
		})
	}
}

func TestCommandAcknowledgementAndEmptyRowsetAreDifferent(t *testing.T) {
	for _, columns := range [][]string{{}, {"id"}} {
		types := []string{}
		if len(columns) > 0 {
			types = []string{"BIGINT"}
		}
		fixture := &queryFixture{columns: columns, types: types}
		result, err := execute(context.Background(), fixtureDB(t, fixture), "SELECT fixture", 1000, false)
		if err != nil {
			t.Fatal(err)
		}
		if result.IsQuery != (len(columns) > 0) || len(result.Rows) != 0 {
			t.Fatal("command acknowledgement confused with empty SELECT")
		}
	}
}
