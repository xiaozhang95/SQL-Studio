package postgresql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
)

func TestStreamTableDataBeyondQueryLimitAndCancellation(t *testing.T) {
	for _, stop := range []bool{false, true} {
		fixture := &queryFixture{columns: []string{"id", "text", "binary"}, types: []string{"BIGINT", "TEXT", "BYTEA"}}
		for i := 0; i < 6001; i++ {
			fixture.rows = append(fixture.rows, []driver.Value{int64(9007199254740993), "中文\ntext", []byte{0, 255}})
		}
		client := NewClient()
		client.open = func(connection model.Connection, database string) (*sql.DB, error) {
			if connection.ID != "owner" || database != "same-db" {
				t.Error("wrong export scope")
			}
			return sql.OpenDB(fixtureConnector{fixture}), nil
		}
		count, batches := 0, 0
		sentinel := errors.New("file write failed")
		err := client.StreamTableData(context.Background(), model.Connection{ID: "owner"}, model.TableRef{Database: "same-db", Name: `"a.b"."same-table"`}, func(result model.QueryResult) error {
			batches++
			if stop {
				return sentinel
			}
			if len(result.Rows) > 256 || result.Truncated {
				t.Error("unbounded or truncated batch")
			}
			for _, row := range result.Rows {
				if row[0] != "9007199254740993" || row[2] != "\\x00ff" {
					t.Error("precision or binary changed")
				}
			}
			count += len(result.Rows)
			return nil
		})
		if stop && !errors.Is(err, sentinel) {
			t.Fatal(err)
		}
		if !stop && (err != nil || count != 6001 || batches < 24) {
			t.Fatalf("count=%d batches=%d error=%v", count, batches, err)
		}
		if !fixture.readOnly || !fixture.rowsClosed || !fixture.connectionClosed {
			t.Fatal("export leaked cursor/connection or was writable")
		}
	}
}

func TestStreamTableDataRejectsOversizedRow(t *testing.T) {
	fixture := &queryFixture{columns: []string{"text"}, types: []string{"TEXT"}, rows: [][]driver.Value{{strings.Repeat("x", 8*1024*1024+1)}}}
	client := NewClient()
	client.open = func(model.Connection, string) (*sql.DB, error) { return sql.OpenDB(fixtureConnector{fixture}), nil }
	err := client.StreamTableData(context.Background(), model.Connection{ID: "owner"}, model.TableRef{Database: "same-db", Name: "table"}, func(model.QueryResult) error { t.Error("oversized record emitted"); return nil })
	if err == nil || !strings.Contains(err.Error(), "8 MiB") || !fixture.rowsClosed {
		t.Fatal(err)
	}
}
