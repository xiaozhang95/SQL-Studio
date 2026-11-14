package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// Insert bounded prepared batches on the dedicated target connection.
// The source transaction holds the cursor and table metadata until transfer completes.
func copySyncRows(ctx context.Context, from *sql.Tx, to *sql.Conn, database string, table syncTable, copied func(int64) error) error {
	columns := strings.Join(table.columns, ",")
	rows, err := from.QueryContext(ctx, "SELECT "+columns+" FROM "+quoteIdentifier(database)+"."+quoteIdentifier(table.name))
	if err != nil {
		return err
	}
	defer rows.Close()
	prefix := "INSERT INTO " + quoteIdentifier(table.name) + " (" + columns + ") VALUES "
	width := len(table.columns)
	tuple := "(" + strings.TrimSuffix(strings.Repeat("?,", width), ",") + ")"
	maxRows := min(128, 65535/width)
	const batchBytes = 512 * 1024
	const maxRowBytes = 8 * 1024 * 1024
	batch := make([]any, 0, maxRows*width)
	size := 0
	values := make([]sql.RawBytes, width)
	fields := make([]any, width)
	for i := range fields {
		fields[i] = &values[i]
	}
	flush := func() error {
		count := len(batch) / width
		if count == 0 {
			return nil
		}
		statement := prefix + strings.TrimSuffix(strings.Repeat(tuple+",", count), ",")
		if _, err := to.ExecContext(ctx, statement, batch...); err != nil {
			return err
		}
		clear(batch)
		batch, size = batch[:0], 0
		return copied(int64(count))
	}
	for rows.Next() {
		if err := rows.Scan(fields...); err != nil {
			return err
		}
		rowBytes := 16 * width
		for _, value := range values {
			rowBytes += len(value)
		}
		if rowBytes > maxRowBytes {
			return fmt.Errorf("表含超过同步单行大小限制的记录：%s", table.name)
		}
		if size+rowBytes > batchBytes || len(batch)/width == maxRows {
			if err := flush(); err != nil {
				return err
			}
		}
		for _, value := range values {
			if value == nil {
				batch = append(batch, nil)
			} else {
				// A non-nil empty slice must remain distinct from SQL NULL.
				data := make([]byte, len(value))
				copy(data, value)
				batch = append(batch, data)
			}
		}
		size += rowBytes
	}
	if err := rows.Err(); err != nil {
		return err
	}
	return flush()
}
