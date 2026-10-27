package mysql

import (
	"context"
	"database/sql"
	"errors"

	"sql-studio-backend/internal/model"
)

func (c *Client) Databases(ctx context.Context, connection model.Connection) ([]string, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, "")
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, "SHOW DATABASES")
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

func (c *Client) Indexes(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Index, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return nil, err
	}
	defer release()
	// 使用跨 MySQL 版本的字段读取，不依赖 8.0 才提供的 EXPRESSION 列。
	rows, err := db.QueryContext(ctx, "SELECT INDEX_NAME,NON_UNIQUE,INDEX_TYPE,COALESCE(COLUMN_NAME,''),SEQ_IN_INDEX,SUB_PART,COALESCE(COLLATION,'') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY CASE WHEN INDEX_NAME='PRIMARY' THEN 0 ELSE 1 END,INDEX_NAME,SEQ_IN_INDEX", ref.Database, ref.Name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return readIndexes(rows)
}

func readIndexes(rows *sql.Rows) ([]model.Index, error) {
	out := []model.Index{}
	for rows.Next() {
		var name, kind string
		var nonUnique int
		var column model.IndexColumn
		if err := rows.Scan(&name, &nonUnique, &kind, &column.Name, &column.Position, &column.PrefixLength, &column.Order); err != nil {
			return nil, err
		}
		if len(out) == 0 || out[len(out)-1].Name != name {
			out = append(out, model.Index{Name: name, Unique: nonUnique == 0, Type: kind, Columns: []model.IndexColumn{}})
		}
		out[len(out)-1].Columns = append(out[len(out)-1].Columns, column)
	}
	return out, rows.Err()
}

func (c *Client) Tables(ctx context.Context, connection model.Connection, schema string) ([]model.Table, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, schema)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, "SELECT TABLE_NAME,TABLE_TYPE,COALESCE(TABLE_COMMENT,'') FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME", schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Table{}
	for rows.Next() {
		var table model.Table
		if err = rows.Scan(&table.Name, &table.Type, &table.Comment); err != nil {
			return nil, err
		}
		out = append(out, table)
	}
	return out, rows.Err()
}

func (c *Client) Columns(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Column, error) {
	schema, table := ref.Database, ref.Name
	ctx, db, release, err := c.openRequest(ctx, connection, schema)
	if err != nil {
		return nil, err
	}
	defer release()
	rows, err := db.QueryContext(ctx, "SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY,COLUMN_DEFAULT,EXTRA,COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", schema, table)
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

func (c *Client) DDL(ctx context.Context, connection model.Connection, ref model.TableRef) (string, error) {
	schema, table := ref.Database, ref.Name
	ctx, db, release, err := c.openRequest(ctx, connection, schema)
	if err != nil {
		return "", err
	}
	defer release()
	// 库名/表名不能使用参数占位符，因此统一转义反引号。
	rows, err := db.QueryContext(ctx, "SHOW CREATE TABLE "+quoteIdentifier(schema)+"."+quoteIdentifier(table))
	if err != nil {
		return "", err
	}
	defer rows.Close()
	if !rows.Next() {
		if err = rows.Err(); err != nil {
			return "", err
		}
		return "", errors.New("未找到表结构")
	}
	columns, err := rows.Columns()
	if err != nil {
		return "", err
	}
	if len(columns) < 2 {
		return "", errors.New("数据库返回的 DDL 结构不完整")
	}
	values := make([]any, len(columns))
	pointers := make([]any, len(columns))
	for i := range values {
		pointers[i] = &values[i]
	}
	if err = rows.Scan(pointers...); err != nil {
		return "", err
	}
	switch value := values[1].(type) {
	case []byte:
		return string(value), nil
	case string:
		return value, nil
	default:
		return "", errors.New("数据库返回的 DDL 类型不受支持")
	}
}
