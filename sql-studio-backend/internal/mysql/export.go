package mysql

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/rowstream"
)

// StreamTableData uses one read-only cursor and respects connection/database closure.
func (c *Client) StreamTableData(ctx context.Context, connection model.Connection, ref model.TableRef, emit func(model.QueryResult) error) error {
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return err
	}
	defer release()
	tx, err := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	columns, err := exportColumns(ctx, tx, ref)
	if err != nil {
		return err
	}
	rows, err := tx.QueryContext(ctx, "SELECT "+strings.Join(columns, ",")+" FROM "+quoteIdentifier(ref.Database)+"."+quoteIdentifier(ref.Name))
	if err != nil {
		return err
	}
	return rowstream.Read(ctx, rows, emit)
}

// SELECT * omits invisible columns in both MySQL and MariaDB.
func exportColumns(ctx context.Context, tx *sql.Tx, ref model.TableRef) ([]string, error) {
	rows, err := tx.QueryContext(ctx, "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", ref.Database, ref.Name)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var columns []string
	for rows.Next() {
		var name string
		if err = rows.Scan(&name); err != nil {
			return nil, err
		}
		columns = append(columns, quoteIdentifier(name))
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, errors.New("未找到可导出的表字段")
	}
	return columns, nil
}
