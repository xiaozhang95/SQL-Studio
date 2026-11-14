package postgresql

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model"
	"strings"
)

func (c *Client) Databases(ctx context.Context, connection model.Connection) ([]string, error) {
	return c.listDatabases(ctx, connection, false)
}

func (c *Client) SyncDatabases(ctx context.Context, connection model.Connection) ([]string, error) {
	return c.listDatabases(ctx, connection, true)
}

func (c *Client) listDatabases(ctx context.Context, connection model.Connection, probe bool) ([]string, error) {
	ctx, db, release, err := c.openScopedRequest(ctx, connection, "", probe)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, `SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate AND has_database_privilege(datname, 'CONNECT') ORDER BY datname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var name string
		if err = rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}
func (c *Client) Tables(ctx context.Context, connection model.Connection, database string) ([]model.Table, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, database)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, `SELECT n.nspname,c.relname,
		CASE WHEN c.relkind IN ('v','m') THEN 'VIEW' ELSE 'BASE TABLE' END,
		COALESCE(obj_description(c.oid,'pg_class'),''),
		CASE WHEN c.relkind IN ('v','m') THEN (
			SELECT json_agg(DISTINCT ARRAY[dn.nspname::text, dc.relname::text])
			FROM pg_catalog.pg_rewrite rw JOIN pg_catalog.pg_depend d
				ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=rw.oid AND d.refclassid='pg_catalog.pg_class'::regclass
			JOIN pg_catalog.pg_class dc ON dc.oid=d.refobjid
			JOIN pg_catalog.pg_namespace dn ON dn.oid=dc.relnamespace
			WHERE rw.ev_class=c.oid AND rw.rulename='_RETURN' AND dc.oid<>c.oid AND dc.relkind IN ('v','m')
		) END,
		COALESCE((
			SELECT e.extname FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid
			WHERE d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid AND d.objsubid=0
			AND d.refclassid='pg_catalog.pg_extension'::regclass AND d.deptype='e'
		),'')
		FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
		WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname <> 'information_schema' AND left(n.nspname,3) <> 'pg_'
		AND has_schema_privilege(n.oid,'USAGE') AND has_table_privilege(c.oid,'SELECT') ORDER BY n.nspname,c.relname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Table{}
	for rows.Next() {
		var schema, name string
		var table model.Table
		var dependencies []byte
		if err = rows.Scan(&schema, &name, &table.Type, &table.Comment, &dependencies, &table.Extension); err != nil {
			return nil, err
		}
		table.Name = quoteIdentifier(schema) + "." + quoteIdentifier(name)
		if len(dependencies) > 0 {
			var names [][2]string
			if err = json.Unmarshal(dependencies, &names); err != nil {
				return nil, err
			}
			for _, name := range names {
				table.ViewDependencies = append(table.ViewDependencies, quoteIdentifier(name[0])+"."+quoteIdentifier(name[1]))
			}
		}
		out = append(out, table)
	}
	return out, rows.Err()
}

const columnsSQL = `SELECT a.attname,format_type(a.atttypid,a.atttypmod),CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END,CASE WHEN EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=c.oid AND i.indisprimary AND a.attnum=ANY(i.indkey)) THEN 'PRI' ELSE '' END,pg_get_expr(d.adbin,d.adrelid),CASE WHEN a.attgenerated<>'' THEN 'STORED GENERATED' WHEN a.attidentity<>'' THEN 'IDENTITY' ELSE '' END,COALESCE(col_description(c.oid,a.attnum),'') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relname=$2 AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`

func readColumns(ctx context.Context, db *sql.DB, schema, table string) ([]model.Column, error) {
	rows, err := db.QueryContext(ctx, columnsSQL, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Column{}
	for rows.Next() {
		var col model.Column
		if err = rows.Scan(&col.Name, &col.Type, &col.Nullable, &col.Key, &col.Default, &col.Extra, &col.Comment); err != nil {
			return nil, err
		}
		out = append(out, col)
	}
	return out, rows.Err()
}
func (c *Client) Columns(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Column, error) {
	schema, table, err := relation(ref.Name)
	if err != nil {
		return nil, err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return nil, err
	}
	defer release()
	return readColumns(ctx, db, schema, table)
}
func (c *Client) Indexes(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Index, error) {
	schema, table, err := relation(ref.Name)
	if err != nil {
		return nil, err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, `SELECT ic.relname,i.indisprimary,i.indisunique,am.amname,pg_get_indexdef(i.indexrelid,k.pos::int,false),k.pos::int,CASE WHEN (i.indoption[k.pos-1] & 1)=1 THEN 'D' ELSE 'A' END FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_am am ON am.oid=ic.relam CROSS JOIN LATERAL generate_series(1,i.indnkeyatts) k(pos) WHERE n.nspname=$1 AND t.relname=$2 ORDER BY i.indisprimary DESC,ic.relname,k.pos`, schema, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Index{}
	for rows.Next() {
		var name, kind string
		var unique, primary bool
		var col model.IndexColumn
		if err = rows.Scan(&name, &primary, &unique, &kind, &col.Name, &col.Position, &col.Order); err != nil {
			return nil, err
		}
		if len(out) == 0 || out[len(out)-1].Name != name {
			out = append(out, model.Index{Name: name, Primary: primary, Unique: unique, Type: kind, Columns: []model.IndexColumn{}})
		}
		out[len(out)-1].Columns = append(out[len(out)-1].Columns, col)
	}
	return out, rows.Err()
}

// DDL uses PostgreSQL catalog deparsers, including constraints/indexes and partition clauses.
// Output is a structural reference; pg_dump remains required for a complete backup.
func (c *Client) DDL(ctx context.Context, connection model.Connection, ref model.TableRef) (string, error) {
	schema, table, err := relation(ref.Name)
	if err != nil {
		return "", err
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return "", err
	}
	defer release()
	// 在同一物理连接中限制反解析搜索路径，确保序列、类型和函数引用完整限定 schema。
	conn, err := db.Conn(ctx)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	if _, err = conn.ExecContext(ctx, "SET search_path TO pg_catalog"); err != nil {
		return "", err
	}
	return tableDefinition(ctx, conn, schema, table, true)
}

type definitionReader interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func tableDefinition(ctx context.Context, conn definitionReader, schema, table string, includeForeignKeys bool) (string, error) {
	var kind string
	var oid int64
	var partition bool
	err := conn.QueryRowContext(ctx, `SELECT c.oid::bigint,c.relkind::text,c.relispartition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`, schema, table).Scan(&oid, &kind, &partition)
	if err != nil {
		return "", err
	}
	qualified := quoteIdentifier(schema) + "." + quoteIdentifier(table)
	if kind == "v" || kind == "m" {
		var definition string
		if err = conn.QueryRowContext(ctx, `SELECT pg_get_viewdef($1::oid,true)`, oid).Scan(&definition); err != nil {
			return "", err
		}
		prefix := "CREATE VIEW "
		if kind == "m" {
			prefix = "CREATE MATERIALIZED VIEW "
		}
		return prefix + qualified + " AS\n" + strings.TrimSuffix(definition, ";") + ";", nil
	}
	if partition || kind == "f" {
		return "", errors.New("分区子表和外部表请使用 pg_dump 导出完整 DDL")
	}
	rows, err := conn.QueryContext(ctx, `SELECT quote_ident(a.attname)||' '||format_type(a.atttypid,a.atttypmod)||CASE WHEN a.attgenerated<>'' THEN ' GENERATED ALWAYS AS ('||pg_get_expr(d.adbin,d.adrelid)||') STORED' WHEN a.attidentity='a' THEN ' GENERATED ALWAYS AS IDENTITY' WHEN a.attidentity='d' THEN ' GENERATED BY DEFAULT AS IDENTITY' WHEN d.adbin IS NOT NULL THEN ' DEFAULT '||pg_get_expr(d.adbin,d.adrelid) ELSE '' END||CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=$1::oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, oid)
	if err != nil {
		return "", err
	}
	clauses := []string{}
	for rows.Next() {
		var line string
		if err = rows.Scan(&line); err != nil {
			rows.Close()
			return "", err
		}
		clauses = append(clauses, line)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return "", err
	}
	rows, err = conn.QueryContext(ctx, `SELECT 'CONSTRAINT '||quote_ident(conname)||' '||pg_get_constraintdef(oid,true) FROM pg_constraint WHERE conrelid=$1::oid AND contype IN ('p','u','f','c','x') AND (contype <> 'f' OR $2) ORDER BY conname`, oid, includeForeignKeys)
	if err != nil {
		return "", err
	}
	for rows.Next() {
		var line string
		if err = rows.Scan(&line); err != nil {
			rows.Close()
			return "", err
		}
		clauses = append(clauses, line)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return "", err
	}
	ddl := "CREATE TABLE " + qualified + " (\n  " + strings.Join(clauses, ",\n  ") + "\n)"
	if kind == "p" {
		var key string
		if err = conn.QueryRowContext(ctx, `SELECT pg_get_partkeydef($1::oid)`, oid).Scan(&key); err != nil {
			return "", err
		}
		ddl += " PARTITION BY " + key
	}
	ddl += ";\n"
	rows, err = conn.QueryContext(ctx, `SELECT pg_get_indexdef(i.indexrelid) FROM pg_index i WHERE i.indrelid=$1::oid AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid) ORDER BY i.indexrelid`, oid)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	for rows.Next() {
		var line string
		if err = rows.Scan(&line); err != nil {
			return "", err
		}
		ddl += line + ";\n"
	}
	return ddl, rows.Err()
}

func (c *Client) Schemas(ctx context.Context, connection model.Connection, database string) ([]string, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, database)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, `SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname <> 'information_schema' AND left(nspname,3) <> 'pg_' AND has_schema_privilege(oid,'USAGE') ORDER BY nspname`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var name string
		if err = rows.Scan(&name); err != nil {
			return nil, err
		}
		out = append(out, name)
	}
	return out, rows.Err()
}
