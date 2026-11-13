package mysql

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	"sql-studio-backend/internal/model"
)

type matchRowsKey struct{}

const maxResultBytes = 8 * 1024 * 1024

func (c *Client) Execute(ctx context.Context, connection model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	if input.Schema != "" {
		return model.QueryResult{}, errors.New("MySQL 不使用独立 schema 范围")
	}
	if input.MatchRows {
		ctx = context.WithValue(ctx, matchRowsKey{}, true)
	}
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return model.QueryResult{}, err
	}
	defer release()
	return executeResult(ctx, db, input.SQL, input.Limit, input.AllowWrite, connection.Type == model.TypeMariaDB && hasReturning(input.SQL))
}

func execute(ctx context.Context, db *sql.DB, statement string, limit int, allowWrite bool) (result model.QueryResult, err error) {
	return executeResult(ctx, db, statement, limit, allowWrite, false)
}

// ExecuteStatement runs a statement classified and validated by another
// MySQL-protocol engine, using this client's request lifecycle and result limits.
func (c *Client) ExecuteStatement(ctx context.Context, connection model.Connection, input model.QueryRequest, returnsRows bool) (model.QueryResult, error) {
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return model.QueryResult{}, err
	}
	defer release()
	return executeAutocommit(ctx, db, input.SQL, input.Limit, returnsRows)
}

func executeResult(ctx context.Context, db *sql.DB, statement string, limit int, allowWrite, returning bool) (result model.QueryResult, err error) {
	// DDL 可隐式提交并逃离只读事务，必须在发送 SQL 前拒绝；读查询仍保留数据库只读事务。
	if !allowWrite {
		start := time.Now()
		defer func() { result.DurationMS = time.Since(start).Milliseconds() }()
		result = model.QueryResult{Columns: []model.ResultColumn{}, Rows: [][]any{}}
		if !isReadOnlyStatement(statement) {
			return result, errors.New("只读查询不允许该语句；写入需通过显式写入操作提交")
		}
		tx, e := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
		if e != nil {
			return result, e
		}
		defer tx.Rollback()
		return readRows(ctx, tx, statement, limit, start)
	}
	return executeAutocommit(ctx, db, statement, limit, isQuery(statement) || returning)
}

func executeAutocommit(ctx context.Context, db *sql.DB, statement string, limit int, returnsRows bool) (result model.QueryResult, err error) {
	start := time.Now()
	defer func() { result.DurationMS = time.Since(start).Milliseconds() }()
	if returnsRows {
		return readRows(ctx, db, statement, limit, start)
	}
	result.Columns = []model.ResultColumn{}
	result.Rows = [][]any{}
	r, e := db.ExecContext(ctx, statement)
	if e != nil {
		return result, e
	}
	result.AffectedRows, _ = r.RowsAffected()
	if id, e := r.LastInsertId(); e == nil && id != 0 {
		result.LastInsertID = strconv.FormatInt(id, 10)
	}
	return result, nil
}

type querier interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func readRows(ctx context.Context, q querier, statement string, limit int, start time.Time) (model.QueryResult, error) {
	result := model.QueryResult{Columns: []model.ResultColumn{}, Rows: [][]any{}, IsQuery: true}
	queryCtx, cancel := context.WithCancel(ctx)
	rows, err := q.QueryContext(queryCtx, statement)
	if err != nil {
		cancel()
		return result, err
	}
	// 超出返回上限后先取消查询再关闭游标，避免继续排空整个大结果集。
	defer func() { cancel(); _ = rows.Close() }()
	types, err := rows.ColumnTypes()
	if err != nil {
		return result, err
	}
	result.IsQuery = len(types) > 0
	for _, column := range types {
		result.Columns = append(result.Columns, model.ResultColumn{Name: column.Name(), Type: column.DatabaseTypeName()})
	}
	size := 0
	for rows.Next() {
		if len(result.Rows) >= limit {
			result.Truncated = true
			break
		}
		values := make([]any, len(types))
		pointers := make([]any, len(types))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err = rows.Scan(pointers...); err != nil {
			return result, err
		}
		for i, value := range values {
			switch v := value.(type) {
			case []byte:
				switch types[i].DatabaseTypeName() {
				case "BINARY", "VARBINARY", "BLOB", "MEDIUMBLOB", "LONGBLOB", "TINYBLOB", "BIT", "GEOMETRY":
					values[i] = "0x" + hex.EncodeToString(v)
					size += len(v)*2 + 2
				default:
					values[i] = string(v)
					size += len(v)
				}
			case int64:
				values[i] = strconv.FormatInt(v, 10)
				size += 24
			case uint64:
				values[i] = strconv.FormatUint(v, 10)
				size += 24
			default:
				size += len(fmt.Sprint(value))
			}
		}
		if size > maxResultBytes {
			result.Truncated = true
			break
		}
		result.Rows = append(result.Rows, values)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.RowCount = len(result.Rows)
	result.DurationMS = time.Since(start).Milliseconds()
	return result, nil
}
