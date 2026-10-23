package postgres

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"sqldesk/internal/model"
)

const maxResultBytes = 8 * 1024 * 1024

type querier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func (c *Client) Execute(ctx context.Context, connection model.Connection, input model.QueryRequest) (result model.QueryResult, err error) {
	started := time.Now()
	defer func() { result.DurationMS = time.Since(started).Milliseconds() }()
	conn, err := Open(ctx, connection, input.Database, input.Schema)
	if err != nil {
		return result, err
	}
	defer conn.Close(context.Background())
	var query querier = conn
	if !input.AllowWrite {
		tx, e := conn.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
		if e != nil {
			return result, e
		}
		defer tx.Rollback(context.Background())
		query = tx
	}
	queryCtx, cancel := context.WithCancel(ctx)
	rows, err := query.Query(queryCtx, input.SQL, pgx.QueryResultFormats{pgx.TextFormatCode})
	if err != nil {
		cancel()
		return result, err
	}
	defer func() { cancel(); rows.Close() }()
	result.Columns = []model.ResultColumn{}
	result.Rows = [][]any{}
	fields := rows.FieldDescriptions()
	types := pgtype.NewMap()
	for _, field := range fields {
		typ := "OID " + strconv.FormatUint(uint64(field.DataTypeOID), 10)
		if known, ok := types.TypeForOID(field.DataTypeOID); ok {
			typ = strings.ToUpper(known.Name)
		}
		result.Columns = append(result.Columns, model.ResultColumn{Name: field.Name, Type: typ})
	}
	result.IsQuery = len(fields) > 0
	size := 0
	for rows.Next() {
		if len(result.Rows) >= input.Limit {
			result.Truncated = true
			break
		}
		raw := rows.RawValues()
		row := make([]any, len(raw))
		// 文本协议保留 NUMERIC、BIGINT、时间、JSON、数组的原始精度，避免经 float64 解码。
		for i, value := range raw {
			if value == nil {
				row[i] = nil
				continue
			}
			text := string(value)
			if fields[i].DataTypeOID == pgtype.ByteaOID && strings.HasPrefix(text, `\x`) {
				text = "0x" + text[2:]
			}
			row[i] = text
			size += len(text)
		}
		if size > maxResultBytes {
			result.Truncated = true
			break
		}
		result.Rows = append(result.Rows, row)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.RowCount = len(result.Rows)
	if !result.IsQuery {
		result.AffectedRows = rows.CommandTag().RowsAffected()
	}
	return result, nil
}
