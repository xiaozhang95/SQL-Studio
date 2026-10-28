package rowstream

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"sql-studio-backend/internal/model"
)

// Read preserves precision and binary values without collecting the whole table.
// The caller owns the read-only transaction; every batch must be consumed before return.
func Read(ctx context.Context, rows *sql.Rows, emit func(model.QueryResult) error) error {
	defer rows.Close()
	types, err := rows.ColumnTypes()
	if err != nil {
		return err
	}
	columns := make([]model.ResultColumn, len(types))
	for i, column := range types {
		columns[i] = model.ResultColumn{Name: column.Name(), Type: column.DatabaseTypeName()}
	}
	batch := model.QueryResult{Columns: columns, Rows: [][]any{}, IsQuery: true}
	size := 0
	flush := func() error {
		batch.RowCount = len(batch.Rows)
		if err := emit(batch); err != nil {
			return err
		}
		batch.Rows = [][]any{}
		size = 0
		return nil
	}
	for rows.Next() {
		if err := ctx.Err(); err != nil {
			return err
		}
		values, pointers := make([]any, len(types)), make([]any, len(types))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err := rows.Scan(pointers...); err != nil {
			return err
		}
		rowBytes := 0
		for i, value := range values {
			switch v := value.(type) {
			case []byte:
				switch strings.ToUpper(types[i].DatabaseTypeName()) {
				case "BINARY", "VARBINARY", "BLOB", "MEDIUMBLOB", "LONGBLOB", "TINYBLOB", "BIT", "GEOMETRY":
					values[i] = "0x" + hex.EncodeToString(v)
				case "BYTEA":
					values[i] = "\\x" + hex.EncodeToString(v)
				default:
					values[i] = string(v)
				}
			case int64:
				values[i] = strconv.FormatInt(v, 10)
			case uint64:
				values[i] = strconv.FormatUint(v, 10)
			case float64:
				values[i] = strconv.FormatFloat(v, 'g', -1, 64)
			case time.Time:
				switch strings.ToUpper(types[i].DatabaseTypeName()) {
				case "DATE":
					values[i] = v.Format("2006-01-02")
				case "TIMESTAMP":
					values[i] = v.Format("2006-01-02 15:04:05.999999999")
				default:
					values[i] = v.Format(time.RFC3339Nano)
				}
			}
			rowBytes += len(fmt.Sprint(values[i]))
		}
		// A single oversized record fails explicitly; it is never silently truncated.
		if rowBytes > 8*1024*1024 {
			return errors.New("单行导出内容超过 8 MiB，导出已停止，未生成完整文件")
		}
		batch.Rows = append(batch.Rows, values)
		size += rowBytes
		if len(batch.Rows) >= 256 || size >= 128*1024 {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	// Empty tables still carry their column definitions.
	return flush()
}
