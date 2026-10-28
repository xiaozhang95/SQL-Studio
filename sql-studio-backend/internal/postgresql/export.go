package postgresql

import (
	"context"
	"database/sql"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/rowstream"
)

// StreamTableData uses one read-only cursor and respects connection/database closure.
func (c *Client) StreamTableData(ctx context.Context, connection model.Connection, ref model.TableRef, emit func(model.QueryResult) error) error {
	schema, table, err := relation(ref.Name)
	if err != nil {
		return err
	}
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
	rows, err := tx.QueryContext(ctx, "SELECT * FROM "+quoteIdentifier(schema)+"."+quoteIdentifier(table))
	if err != nil {
		return err
	}
	return rowstream.Read(ctx, rows, emit)
}
