package oracle

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

	"github.com/sijms/go-ora/v2/network"

	"sql-studio-backend/internal/model"
)

const resultByteLimit = 8 * 1024 * 1024

func (*Client) ClassifyQueryError(err error) model.QueryErrorKind {
	switch errorCode(err) {
	case "ORA-00001":
		return model.QueryErrorUnique
	case "ORA-01400", "ORA-01407":
		return model.QueryErrorRequired
	case "ORA-02290":
		return model.QueryErrorCheck
	case "ORA-02291", "ORA-02292":
		return model.QueryErrorForeignKey
	case "ORA-01031":
		return model.QueryErrorPermission
	case "ORA-00904", "ORA-00942", "ORA-04043":
		return model.QueryErrorMissing
	case "ORA-00900", "ORA-00907", "ORA-00933", "ORA-00936", "ORA-06550":
		return model.QueryErrorSyntax
	case "ORA-01438", "ORA-01722", "ORA-01830", "ORA-01843", "ORA-01861", "ORA-12899":
		return model.QueryErrorValue
	}
	return ""
}

func errorCode(err error) string {
	var serverError *network.OracleError
	if errors.As(err, &serverError) {
		return fmt.Sprintf("ORA-%05d", serverError.ErrCode)
	}
	return ""
}

func statementError(err error) error {
	if err == nil || errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	code := errorCode(err)
	switch code {
	case "ORA-01012", "ORA-01017", "ORA-01033", "ORA-01034", "ORA-01089", "ORA-01090", "ORA-02396", "ORA-03113", "ORA-03114", "ORA-03135":
		return err
	}
	if strings.HasPrefix(code, "ORA-") && !strings.HasPrefix(code, "ORA-125") || errors.Is(err, errSingleStatement) ||
		errors.Is(err, errReadOnly) || errors.Is(err, errTransactionNeedsBatch) {
		return &model.StatementError{Cause: err}
	}
	return err
}

func (c *Client) Execute(ctx context.Context, connection model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	statement, tokens, err := normalizedStatement(input.SQL)
	if err != nil {
		return model.QueryResult{}, statementError(err)
	}
	if transactionControl(tokens) != "" {
		return model.QueryResult{}, statementError(errTransactionNeedsBatch)
	}
	if !input.AllowWrite && !readOnlySelect(tokens) {
		return model.QueryResult{}, statementError(errReadOnly)
	}
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return model.QueryResult{}, err
	}
	defer release()
	conn, err := db.Conn(ctx)
	if err != nil {
		return model.QueryResult{}, err
	}
	defer conn.Close()
	if err = setSchema(ctx, conn, input.Schema); err != nil {
		return model.QueryResult{}, err
	}
	var result model.QueryResult
	if input.AllowWrite {
		result, err = runStatement(ctx, conn, statement, selectStatement(tokens), input.Limit)
	} else {
		err = readOnlySnapshot(ctx, conn, func(tx *sql.Tx) (bool, error) {
			var readErr error
			result, readErr = runStatement(ctx, tx, statement, true, input.Limit)
			return !result.IsQuery, readErr
		})
	}
	if ctx.Err() != nil {
		err = ctx.Err()
	}
	return result, statementError(err)
}

func setSchema(ctx context.Context, conn *sql.Conn, schema string) error {
	if schema == "" {
		return nil
	}
	if strings.ContainsRune(schema, 0) || len(schema) > 128 {
		return errors.New("Oracle Schema 名称无效")
	}
	_, err := conn.ExecContext(ctx, "ALTER SESSION SET CURRENT_SCHEMA = "+quoteIdentifier(schema))
	return err
}

type transactionStarter interface {
	BeginTx(context.Context, *sql.TxOptions) (*sql.Tx, error)
}

func beginReadOnly(ctx context.Context, db transactionStarter) (*sql.Tx, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "SET TRANSACTION READ ONLY"); err != nil {
		_ = tx.Rollback()
		return nil, err
	}
	return tx, nil
}

// Oracle can reject a snapshot taken immediately after a table/index change
// (ORA-01466). Restart before the first result, never after publishing rows.
func readOnlySnapshot(ctx context.Context, db transactionStarter, read func(*sql.Tx) (mayRetry bool, err error)) error {
	var lastErr error
	for _, delay := range [...]time.Duration{0, 200 * time.Millisecond, 600 * time.Millisecond, 1500 * time.Millisecond, 2500 * time.Millisecond} {
		if delay > 0 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}
		tx, err := beginReadOnly(ctx, db)
		if err != nil {
			return err
		}
		mayRetry, err := read(tx)
		rollbackErr := tx.Rollback()
		if err == nil {
			return rollbackErr
		}
		if !mayRetry || rollbackErr != nil || errorCode(err) != "ORA-01466" {
			return err
		}
		lastErr = err
	}
	return lastErr
}

type sqlExecutor interface {
	querier
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func runStatement(ctx context.Context, executor sqlExecutor, statement string, query bool, limit int) (result model.QueryResult, err error) {
	start := time.Now()
	defer func() { result.DurationMS = time.Since(start).Milliseconds() }()
	result.Columns, result.Rows = []model.ResultColumn{}, [][]any{}
	if !query {
		reply, err := executor.ExecContext(ctx, statement)
		if err != nil {
			return result, err
		}
		if affected, err := reply.RowsAffected(); err == nil {
			result.AffectedRows = affected
		} else {
			result.WriteFeedbackUnavailable = true
		}
		return result, nil
	}
	rows, err := executor.QueryContext(ctx, statement)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	types, err := rows.ColumnTypes()
	if err != nil {
		return result, err
	}
	result.IsQuery = true
	for _, column := range types {
		result.Columns = append(result.Columns, model.ResultColumn{Name: column.Name(), Type: displayType(column.DatabaseTypeName())})
	}
	size := 0
	for rows.Next() {
		if limit != model.UnlimitedQueryRows && len(result.Rows) >= limit {
			result.Truncated, result.TruncatedBy = true, model.QueryRowLimit
			break
		}
		values, pointers := make([]any, len(types)), make([]any, len(types))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err = rows.Scan(pointers...); err != nil {
			return result, err
		}
		size += 24 + 16*len(types)
		for i, value := range values {
			values[i] = encodeValue(types[i].DatabaseTypeName(), value)
			size += len(fmt.Sprint(values[i]))
		}
		if size > resultByteLimit {
			result.OmitOversizedRow(values)
			break
		}
		result.Rows = append(result.Rows, values)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.RowCount = len(result.Rows)
	return result, rows.Close()
}

func encodeValue(kind string, value any) any {
	switch v := value.(type) {
	case []byte:
		switch displayType(kind) {
		case "RAW", "LONG RAW", "BLOB", "BFILE":
			return "0x" + hex.EncodeToString(v)
		default:
			return string(v)
		}
	case int64:
		return strconv.FormatInt(v, 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return strconv.FormatFloat(v, 'g', -1, 64)
		}
	case time.Time:
		switch displayType(kind) {
		case "DATE":
			return v.Format("2006-01-02 15:04:05")
		case "TIMESTAMP":
			return v.Format("2006-01-02 15:04:05.999999999")
		default:
			return v.Format(time.RFC3339Nano)
		}
	}
	return value
}

func displayType(kind string) string {
	switch strings.ToUpper(kind) {
	case "OCICLOBLOCATOR":
		return "CLOB"
	case "OCIBLOBLOCATOR":
		return "BLOB"
	case "OCIFILELOCATOR":
		return "BFILE"
	case "LONGRAW", "LONGVARRAW":
		return "LONG RAW"
	case "LONGVARCHAR":
		return "LONG"
	case "TIMESTAMPDTY":
		return "TIMESTAMP"
	case "TIMESTAMPTZ", "TIMESTAMPTZ_DTY":
		return "TIMESTAMP WITH TIME ZONE"
	case "TIMESTAMPLTZ_DTY", "TIMESTAMPELTZ":
		return "TIMESTAMP WITH LOCAL TIME ZONE"
	case "BFLOAT", "IBFLOAT":
		return "BINARY_FLOAT"
	case "BDOUBLE", "IBDOUBLE":
		return "BINARY_DOUBLE"
	case "INTERVALYM", "INTERVALYM_DTY":
		return "INTERVAL YEAR TO MONTH"
	case "INTERVALDS", "INTERVALDS_DTY":
		return "INTERVAL DAY TO SECOND"
	}
	return strings.ToUpper(kind)
}
