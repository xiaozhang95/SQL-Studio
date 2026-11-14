package mysql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"strings"
	"testing"

	"sql-studio-backend/internal/model"
)

func configureExportFixture(t *testing.T, data *queryFixture, ref model.TableRef, expectedQuery string) {
	t.Helper()
	catalog := &queryFixture{columns: []string{"COLUMN_NAME"}, types: []string{"VARCHAR"}}
	for _, name := range data.columns {
		catalog.rows = append(catalog.rows, []driver.Value{name})
	}
	data.queryRows = func(query string, args []driver.NamedValue) (driver.Rows, error) {
		if strings.Contains(query, "information_schema.COLUMNS") {
			if len(args) != 2 || args[0].Value != ref.Database || args[1].Value != ref.Name || !strings.HasSuffix(query, "ORDER BY ORDINAL_POSITION") {
				t.Errorf("wrong export column scope or order: %s %v", query, args)
			}
			return &fixtureRows{fixture: catalog}, nil
		}
		if query != expectedQuery || !catalog.rowsClosed {
			t.Errorf("wrong column projection or catalog cursor still open: %s", query)
		}
		return &fixtureRows{fixture: data}, nil
	}
}

func TestStreamTableDataBeyondQueryLimitAndCancellation(t *testing.T) {
	for _, stop := range []bool{false, true} {
		ref := model.TableRef{Database: "same-db", Name: "same-table"}
		fixture := &queryFixture{columns: []string{"id", "hidden`text", "binary"}, types: []string{"BIGINT", "TEXT", "BLOB"}}
		for i := 0; i < 6001; i++ {
			fixture.rows = append(fixture.rows, []driver.Value{int64(9007199254740993), "中文\ntext", []byte{0, 255}})
		}
		client := NewClient()
		configureExportFixture(t, fixture, ref, "SELECT `id`,`hidden``text`,`binary` FROM `same-db`.`same-table`")
		client.open = func(connection model.Connection, database string) (*sql.DB, error) {
			if connection.ID != "owner" || database != "same-db" {
				t.Error("wrong export scope")
			}
			return sql.OpenDB(fixtureConnector{fixture}), nil
		}
		count, batches := 0, 0
		sentinel := errors.New("file write failed")
		err := client.StreamTableData(context.Background(), model.Connection{ID: "owner"}, ref, func(result model.QueryResult) error {
			batches++
			if stop {
				return sentinel
			}
			if len(result.Rows) > 256 || result.Truncated {
				t.Error("unbounded or truncated batch")
			}
			for _, row := range result.Rows {
				if row[0] != "9007199254740993" || row[2] != "0x00ff" {
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
	ref := model.TableRef{Database: "db", Name: "table"}
	fixture := &queryFixture{columns: []string{"text"}, types: []string{"TEXT"}, rows: [][]driver.Value{{strings.Repeat("x", 8*1024*1024+1)}}}
	configureExportFixture(t, fixture, ref, "SELECT `text` FROM `db`.`table`")
	client := NewClient()
	client.open = func(model.Connection, string) (*sql.DB, error) { return sql.OpenDB(fixtureConnector{fixture}), nil }
	err := client.StreamTableData(context.Background(), model.Connection{ID: "owner"}, ref, func(model.QueryResult) error { t.Error("oversized record emitted"); return nil })
	if err == nil || !strings.Contains(err.Error(), "8 MiB") || !fixture.rowsClosed {
		t.Fatal(err)
	}
}
