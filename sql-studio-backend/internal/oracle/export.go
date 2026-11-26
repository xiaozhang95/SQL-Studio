package oracle

import (
	"context"
	"database/sql"
	"strings"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/rowstream"
)

func (c *Client) StreamTableData(ctx context.Context, connection model.Connection, ref model.TableRef, emit func(model.QueryResult) error) error {
	columns, err := c.Columns(ctx, connection, ref)
	if err != nil {
		return err
	}
	if len(columns) == 0 {
		return sql.ErrNoRows
	}
	names := make([]string, len(columns))
	for i, column := range columns {
		names[i] = quoteIdentifier(column.Name)
	}
	ctx, db, release, err := c.openRequest(ctx, connection, ref.Database)
	if err != nil {
		return err
	}
	defer release()
	statement := "SELECT " + strings.Join(names, ", ") + " FROM " + ref.Name
	return readOnlySnapshot(ctx, db, func(tx *sql.Tx) (bool, error) {
		rows, err := tx.QueryContext(ctx, statement)
		if err != nil {
			return true, err
		}
		return false, rowstream.ReadWithEncoder(ctx, rows, emit, encodeValue)
	})
}
