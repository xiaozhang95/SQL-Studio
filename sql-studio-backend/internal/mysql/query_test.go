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
)

// 使用 database/sql 的真实扫描和事务流程，替换网络驱动，不访问 MySQL 实例。
type queryFixture struct {
	columns, types   []string
	rows             [][]driver.Value
	queryError       error
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
func (c fixtureConn) QueryContext(ctx context.Context, _ string, _ []driver.NamedValue) (driver.Rows, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if c.fixture.queryError != nil {
		return nil, c.fixture.queryError
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
	for _, test := range []struct {
		name            string
		rows            [][]driver.Value
		limit, wantRows int
		truncated       bool
	}{
		{"row limit", [][]driver.Value{{[]byte("a")}, {[]byte("b")}}, 1, 1, true},
		{"exact limit", [][]driver.Value{{[]byte("a")}}, 1, 1, false},
		{"byte limit", [][]driver.Value{{make([]byte, maxResultBytes+1)}}, 1000, 0, true},
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
