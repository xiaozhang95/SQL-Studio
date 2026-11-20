package postgresql

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"sql-studio-backend/internal/model"
)

const maxResultBytes = 8 * 1024 * 1024

var errTransactionNeedsBatch = errors.New("请在同一个 SQL 批次中执行 PostgreSQL 事务及其语句")

func (c *Client) ClassifyQueryError(err error) model.QueryErrorKind {
	var serverError *pgconn.PgError
	if !errors.As(err, &serverError) {
		return ""
	}
	switch serverError.Code {
	case "23514":
		return model.QueryErrorCheck
	case "23505":
		return model.QueryErrorUnique
	case "23503":
		return model.QueryErrorForeignKey
	case "23502":
		return model.QueryErrorRequired
	case "42501":
		return model.QueryErrorPermission
	case "42601":
		return model.QueryErrorSyntax
	case "42P01", "42703":
		return model.QueryErrorMissing
	}
	if strings.HasPrefix(serverError.Code, "22") {
		return model.QueryErrorValue
	}
	return ""
}

func (c *Client) Execute(ctx context.Context, connection model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	if transactionControl(input.SQL) {
		return model.QueryResult{}, errTransactionNeedsBatch
	}
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return model.QueryResult{}, err
	}
	defer release()
	if input.Schema != "" {
		conn, e := db.Conn(ctx)
		if e != nil {
			return model.QueryResult{}, e
		}
		defer conn.Close()
		if e = setQuerySchema(ctx, conn, input.Schema); e != nil {
			return model.QueryResult{}, e
		}
		return execute(ctx, conn, input.SQL, input.Limit, input.AllowWrite)
	}
	return execute(ctx, db, input.SQL, input.Limit, input.AllowWrite)
}

func setQuerySchema(ctx context.Context, conn *sql.Conn, schema string) error {
	if schema == "" {
		return nil
	}
	var permitted bool
	if err := conn.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1 AND has_schema_privilege(oid,'USAGE'))", schema).Scan(&permitted); err != nil {
		return err
	}
	if !permitted {
		return errors.New("schema 不存在或无权访问")
	}
	_, err := conn.ExecContext(ctx, "SELECT set_config('search_path',$1,false)", quoteIdentifier(schema))
	return err
}

type queryConnection interface {
	BeginTx(context.Context, *sql.TxOptions) (*sql.Tx, error)
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	PrepareContext(context.Context, string) (*sql.Stmt, error)
}

func execute(ctx context.Context, db queryConnection, statement string, limit int, allowWrite bool) (model.QueryResult, error) {
	result, err := executeQuery(ctx, db, statement, limit, allowWrite, false)
	return result, markStatementError(err)
}

func markStatementError(err error) error {
	var serverError *pgconn.PgError
	if !errors.As(err, &serverError) || len(serverError.Code) < 2 {
		return err
	}
	if serverError.Severity == "FATAL" || serverError.SeverityUnlocalized == "FATAL" || serverError.Code == "3D000" {
		return err
	}
	switch serverError.Code[:2] {
	case "08", "28", "53", "57", "58", "XX":
		return err
	}
	return &model.StatementError{Cause: err}
}

func executeQuery(ctx context.Context, db queryConnection, statement string, limit int, allowWrite, keepSession bool) (result model.QueryResult, err error) {
	start := time.Now()
	defer func() { result.DurationMS = time.Since(start).Milliseconds() }()
	result.Columns = []model.ResultColumn{}
	result.Rows = [][]any{}
	// 默认模式使用数据库只读事务；extended protocol 拒绝多语句请求。
	if !allowWrite {
		tx, e := db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
		if e != nil {
			return result, e
		}
		defer tx.Rollback()
		return readRows(ctx, tx, statement, limit, start, keepSession)
	}
	if isQuery(statement) {
		return readRows(ctx, db, statement, limit, start, keepSession)
	}
	prepared, e := db.PrepareContext(ctx, statement)
	if e != nil {
		return result, e
	}
	defer prepared.Close()
	r, e := prepared.ExecContext(ctx)
	if e != nil {
		return result, e
	}
	result.AffectedRows, _ = r.RowsAffected()

	return result, nil
}

type querier interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func readRows(ctx context.Context, q querier, statement string, limit int, start time.Time, keepSession bool) (model.QueryResult, error) {
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
	unlimitedRows := limit == model.UnlimitedQueryRows
	for rows.Next() {
		if !unlimitedRows && len(result.Rows) >= limit {
			result.Truncated = true
			result.TruncatedBy = model.QueryRowLimit
			break
		}
		if unlimitedRows {
			// Charge for the retained row and value slots, even when the values are empty.
			size += 24 + 16*len(types)
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
				if types[i].DatabaseTypeName() == "BYTEA" {
					values[i] = "\\x" + hex.EncodeToString(v)
					size += len(v)*2 + 2
				} else {
					values[i] = string(v)
					size += len(v)
				}
			case float64:
				if math.IsNaN(v) || math.IsInf(v, 0) {
					values[i] = strconv.FormatFloat(v, 'g', -1, 64)
				}
				size += 24
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
			result.OmitOversizedRow(values)
			break
		}
		result.Rows = append(result.Rows, values)
	}
	// Drain a bounded batch statement before cancellation so PostgreSQL can reuse the same transaction.
	if keepSession {
		if err = rows.Close(); err != nil {
			return result, err
		}
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.RowCount = len(result.Rows)
	result.DurationMS = time.Since(start).Milliseconds()
	return result, nil
}
