package greptimedb

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var syncNumber = regexp.MustCompile(`^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$`)

func copyGreptimeRows(ctx context.Context, source, target *sql.DB, name string, emit func(int64) error) error {
	rows, err := source.QueryContext(ctx, "SELECT * FROM "+quoteIdentifier(name))
	if err != nil {
		return err
	}
	defer rows.Close()
	types, err := rows.ColumnTypes()
	if err != nil {
		return err
	}
	columns := make([]string, len(types))
	values := make([]sql.RawBytes, len(types))
	scan := make([]any, len(types))
	for i, col := range types {
		columns[i] = quoteIdentifier(col.Name())
		scan[i] = &values[i]
	}
	prefix := "INSERT INTO " + quoteIdentifier(name) + " (" + strings.Join(columns, ",") + ") VALUES "
	var tuples []string
	size := 0
	flush := func() error {
		if len(tuples) == 0 {
			return nil
		}
		if _, err := target.ExecContext(ctx, prefix+strings.Join(tuples, ",")); err != nil {
			return err
		}
		count := int64(len(tuples))
		tuples = tuples[:0]
		size = 0
		return emit(count)
	}
	for rows.Next() {
		if err = rows.Scan(scan...); err != nil {
			return err
		}
		cells := make([]string, len(values))
		for i, value := range values {
			cells[i], err = greptimeValue(value, types[i].DatabaseTypeName())
			if err != nil {
				return fmt.Errorf("%s.%s: %w", name, types[i].Name(), err)
			}
		}
		tuple := "(" + strings.Join(cells, ",") + ")"
		if len(tuple) > 8*1024*1024 {
			return errors.New("表含超过同步单行大小限制的记录")
		}
		if size+len(tuple) > 256*1024 || len(tuples) == 256 {
			if err = flush(); err != nil {
				return err
			}
		}
		tuples = append(tuples, tuple)
		size += len(tuple)
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return flush()
}

func greptimeValue(value []byte, kind string) (string, error) {
	if value == nil {
		return "NULL", nil
	}
	switch kind {
	case "TINYINT", "UNSIGNED TINYINT", "SMALLINT", "UNSIGNED SMALLINT", "INT", "UNSIGNED INT", "BIGINT", "UNSIGNED BIGINT", "MEDIUMINT", "UNSIGNED MEDIUMINT", "DECIMAL", "FLOAT", "DOUBLE", "YEAR":
		if !syncNumber.Match(value) {
			return "", errors.New("数值数据格式不完整")
		}
		return string(value), nil
	case "BINARY", "VARBINARY", "BLOB", "MEDIUMBLOB", "LONGBLOB", "TINYBLOB":
		return "X'" + hex.EncodeToString(value) + "'", nil
	default:
		return "'" + strings.NewReplacer("\\", "\\\\", "'", "''", "\x00", "\\0").Replace(string(value)) + "'", nil
	}
}
