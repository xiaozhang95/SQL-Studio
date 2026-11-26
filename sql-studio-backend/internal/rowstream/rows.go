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
	return ReadWithEncoder(ctx, rows, emit, encodeValue)
}

// ReadWithEncoder applies the engine's SQL value representation to every streamed cell.
func ReadWithEncoder(ctx context.Context, rows *sql.Rows, emit func(model.QueryResult) error, encode func(string, any) any) error {
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
			values[i] = encode(types[i].DatabaseTypeName(), value)
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

func encodeValue(kind string, value any) any {
	switch v := value.(type) {
	case []byte:
		switch strings.ToUpper(kind) {
		case "BINARY", "VARBINARY", "BLOB", "MEDIUMBLOB", "LONGBLOB", "TINYBLOB", "BIT", "GEOMETRY":
			return "0x" + hex.EncodeToString(v)
		case "BYTEA":
			return "\\x" + hex.EncodeToString(v)
		default:
			return string(v)
		}
	case int64:
		return strconv.FormatInt(v, 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	case float64:
		return strconv.FormatFloat(v, 'g', -1, 64)
	case time.Time:
		switch strings.ToUpper(kind) {
		case "DATE":
			return v.Format("2006-01-02")
		case "TIMESTAMP":
			return v.Format("2006-01-02 15:04:05.999999999")
		default:
			return v.Format(time.RFC3339Nano)
		}
	}
	return value
}
