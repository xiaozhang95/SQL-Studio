package mysql

import (
	"context"
	"errors"

	"sqldesk/internal/model"
)

func (c *Client) Databases(ctx context.Context, connection model.Connection) ([]string, error) {
	db, err := Open(connection, "")
	if err != nil {
		return nil, err
	}
	defer db.Close()
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

func (c *Client) Tables(ctx context.Context, connection model.Connection, schema string) ([]model.Table, error) {
	db, err := Open(connection, "")
	if err != nil {
		return nil, err
	}
	defer db.Close()
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
	db, err := Open(connection, "")
	if err != nil {
		return nil, err
	}
	defer db.Close()
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
	db, err := Open(connection, "")
	if err != nil {
		return "", err
	}
	defer db.Close()
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
