package postgresql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
)

func TestMetadataPreservesSchemaIdentityAndExplicitDatabase(t *testing.T) {
	f := &queryFixture{columns: []string{"schema", "name", "kind", "comment"}, types: []string{"TEXT", "TEXT", "TEXT", "TEXT"}, rows: [][]driver.Value{{"a.b", `same"table`, "BASE TABLE", "note"}, {"other", `same"table`, "BASE TABLE", "other"}}}
	client := NewClient()
	var receivedDB string
	client.open = func(c model.Connection, db string) (*sql.DB, error) {
		if c.ID != "pg" {
			t.Fatal("wrong connection")
		}
		receivedDB = db
		return sql.OpenDB(fixtureConnector{f}), nil
	}
	tables, err := client.Tables(context.Background(), model.Connection{ID: "pg"}, "physical")
	if err != nil {
		t.Fatal(err)
	}
	if receivedDB != "physical" || len(tables) != 2 || tables[0].Name != `"a.b"."same""table"` || tables[1].Name != `"other"."same""table"` {
		t.Fatal("schema identity lost")
	}
	f = &queryFixture{columns: []string{"name", "type", "nullable", "key", "default", "extra", "comment"}, types: []string{"TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT", "TEXT"}, rows: [][]driver.Value{{"id", "bigint", "NO", "PRI", nil, "IDENTITY", ""}}}
	columns, err := client.Columns(context.Background(), model.Connection{ID: "pg"}, model.TableRef{Database: "physical", Name: tables[0].Name})
	if err != nil {
		t.Fatal(err)
	}
	if len(columns) != 1 || columns[0].Extra != "IDENTITY" || len(f.arguments) != 1 || f.arguments[0][0].Value != "a.b" || f.arguments[0][1].Value != `same"table` {
		t.Fatal("metadata did not parameterize schema/table")
	}
	if !f.rowsClosed || !f.connectionClosed {
		t.Fatal("metadata cursor/connection leaked")
	}
}

func TestDDLDeparsesUsingOneConnectionWithCatalogSearchPath(t *testing.T) {
	f := &queryFixture{}
	f.queryHandler = func(_ context.Context, statement string, _ []driver.NamedValue) (driver.Rows, error) {
		fixture := &queryFixture{columns: []string{"ddl"}, types: []string{"TEXT"}}
		switch {
		case strings.Contains(statement, "c.oid::bigint,c.relkind"):
			fixture.columns = []string{"oid", "kind", "partition"}
			fixture.types = []string{"INT8", "TEXT", "BOOL"}
			fixture.rows = [][]driver.Value{{int64(42), "r", false}}
		case strings.Contains(statement, "quote_ident(a.attname)"):
			fixture.rows = [][]driver.Value{{`id bigint DEFAULT nextval('"s"."sample_id_seq"'::regclass)`}}
		}
		return &fixtureRows{fixture: fixture}, nil
	}
	client := NewClient()
	client.open = func(model.Connection, string) (*sql.DB, error) { return sql.OpenDB(fixtureConnector{f}), nil }
	ddl, err := client.DDL(context.Background(), model.Connection{}, model.TableRef{Database: "db", Name: `"s"."sample"`})
	if err != nil || !strings.Contains(ddl, `nextval('"s"."sample_id_seq"'::regclass)`) {
		t.Fatalf("DDL failed: %s %v", ddl, err)
	}
	if len(f.execQueries) != 1 || f.execQueries[0] != "SET search_path TO pg_catalog" || !f.connectionClosed {
		t.Fatal("DDL deparse search path or connection lifecycle changed")
	}
}
func TestIndexesKeepActualNamesAndExpressions(t *testing.T) {
	f := &queryFixture{columns: []string{"name", "primary", "unique", "type", "column", "position", "order"}, types: []string{"TEXT", "BOOL", "BOOL", "TEXT", "TEXT", "INT4", "TEXT"}, rows: [][]driver.Value{{"t_pkey", true, true, "btree", "id", int64(1), "A"}, {"expr", false, false, "btree", "lower(name)", int64(1), "D"}, {"expr", false, false, "btree", "other", int64(2), "A"}}}
	client := NewClient()
	client.open = func(model.Connection, string) (*sql.DB, error) { return sql.OpenDB(fixtureConnector{f}), nil }
	indexes, err := client.Indexes(context.Background(), model.Connection{}, model.TableRef{Database: "db", Name: `"public"."t"`})
	if err != nil {
		t.Fatal(err)
	}
	if len(indexes) != 2 || indexes[0].Name != "t_pkey" || !indexes[0].Primary || !indexes[0].Unique || len(indexes[1].Columns) != 2 || indexes[1].Columns[0].Name != "lower(name)" || indexes[1].Columns[0].Order != "D" || indexes[1].Columns[0].PrefixLength != nil {
		t.Fatal("index definition lost")
	}
}

func TestSchemaListIncludesEmptySchemasAndClosesResources(t *testing.T) {
	f := &queryFixture{columns: []string{"nspname"}, types: []string{"TEXT"}, rows: [][]driver.Value{{"cron"}, {"empty_schema"}, {"public"}}}
	client := NewClient()
	client.open = func(c model.Connection, db string) (*sql.DB, error) {
		if c.ID != "target" || db != "physical" {
			t.Fatal("schema request crossed scope")
		}
		return sql.OpenDB(fixtureConnector{f}), nil
	}
	schemas, err := client.Schemas(context.Background(), model.Connection{ID: "target"}, "physical")
	if err != nil {
		t.Fatal(err)
	}
	if len(schemas) != 3 || schemas[1] != "empty_schema" || !f.rowsClosed || !f.connectionClosed {
		t.Fatal("schema list or resources lost")
	}
}
