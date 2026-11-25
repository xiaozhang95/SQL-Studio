package mysql

import (
	"context"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"

	driver "github.com/go-sql-driver/mysql"

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
	result, err := executeResult(ctx, db, input.SQL, input.Limit, input.AllowWrite, connection.Type == model.TypeMariaDB && hasReturning(input.SQL))
	return result, queryError(err)
}

func queryError(err error) error {
	var serverError *driver.MySQLError
	if errors.Is(err, driver.ErrPktTooLarge) || (errors.As(err, &serverError) && serverError.Number == 1153) {
		return fmt.Errorf("SQL 数据包超过 MySQL/MariaDB 的 max_allowed_packet 限制：%w", err)
	}
	return markStatementError(err)
}

func markStatementError(err error) error {
	var serverError *driver.MySQLError
	if !errors.As(err, &serverError) {
		return err
	}
	switch string(serverError.SQLState[:2]) {
	case "08", "28":
		return err
	}
	switch serverError.Number {
	case 1040, 1042, 1043, 1044, 1045, 1049, 1053, 1129, 1130, 1153:
		return err
	}
	return &model.StatementError{Cause: err}
}

func (c *Client) ClassifyQueryError(err error) model.QueryErrorKind {
	var serverError *driver.MySQLError
	if !errors.As(err, &serverError) {
		return ""
	}
	switch serverError.Number {
	case 3819, 4025:
		return model.QueryErrorCheck
	case 1062:
		return model.QueryErrorUnique
	case 1451, 1452:
		return model.QueryErrorForeignKey
	case 1048, 1364:
		return model.QueryErrorRequired
	case 1264, 1292, 1366, 1406:
		return model.QueryErrorValue
	case 1044, 1142, 1143, 1227:
		return model.QueryErrorPermission
	case 1064:
		return model.QueryErrorSyntax
	case 1054, 1146:
		return model.QueryErrorMissing
	}
	return ""
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
	result, err := executeAutocommit(ctx, db, input.SQL, input.Limit, returnsRows)
	return result, markStatementError(err)
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
	if mayReturnMultipleResults(statement) {
		return scanRows(ctx, db, statement, limit, time.Now(), false, true)
	}
	return executeAutocommit(ctx, db, statement, limit, isQuery(statement) || returning)
}

type statementExecutor interface {
	querier
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func executeAutocommit(ctx context.Context, db statementExecutor, statement string, limit int, returnsRows bool) (result model.QueryResult, err error) {
	start := time.Now()
	defer func() { result.DurationMS = time.Since(start).Milliseconds() }()
	if returnsRows {
		return readRows(ctx, db, statement, limit, start)
	}
	return execStatement(ctx, db, statement)
}

func execStatement(ctx context.Context, db statementExecutor, statement string) (result model.QueryResult, err error) {
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
	return scanRows(ctx, q, statement, limit, start, false, false)
}

func scanRows(ctx context.Context, q querier, statement string, limit int, start time.Time, keepConnection, multipleResults bool) (result model.QueryResult, err error) {
	result = model.QueryResult{Columns: []model.ResultColumn{}, Rows: [][]any{}, IsQuery: true}
	queryCtx, cancel := context.WithCancel(ctx)
	rows, err := q.QueryContext(queryCtx, statement)
	if err != nil {
		cancel()
		return result, err
	}
	defer func() {
		if keepConnection || multipleResults {
			// Drain under the statement deadline and surface late server errors.
			err = errors.Join(err, rows.Close(), queryCtx.Err())
			cancel()
			return
		}
		cancel()
		_ = rows.Close()
	}()
	budget := resultBudget{rows: limit, bytes: maxResultBytes, chargeRowSlots: multipleResults || limit == model.UnlimitedQueryRows}
	types, err := rows.ColumnTypes()
	if err != nil {
		return result, err
	}
	if multipleResults {
		budget.bytes -= resultSetSize(types)
	}
	result, err = scanResultSet(rows, types, &budget)
	if err != nil {
		return result, err
	}
	if multipleResults {
		// The driver's QueryContext path does not expose the protocol OK counters.
		result.WriteFeedbackUnavailable = !result.IsQuery
		for rows.NextResultSet() {
			types, err = rows.ColumnTypes()
			if err != nil {
				return result, err
			}
			budget.bytes -= resultSetSize(types)
			if budget.bytes < 0 {
				result.ResultSetsTruncated = true
				break
			}
			additional, err := scanResultSet(rows, types, &budget)
			if err != nil {
				return result, err
			}
			result.AdditionalResults = append(result.AdditionalResults, additional)
		}
		if err = rows.Err(); err != nil {
			return result, err
		}
	}
	result.DurationMS = time.Since(start).Milliseconds()
	for i := range result.AdditionalResults {
		result.AdditionalResults[i].DurationMS = result.DurationMS
	}
	return result, nil
}

type resultBudget struct {
	rows           int
	bytes          int
	chargeRowSlots bool
}

// Charge for retained result and column metadata even when a result set has no rows.
func resultSetSize(types []*sql.ColumnType) int {
	size := 192 + 32*len(types)
	for _, column := range types {
		size += len(column.Name()) + len(column.DatabaseTypeName())
	}
	return size
}

func scanResultSet(rows *sql.Rows, types []*sql.ColumnType, budget *resultBudget) (result model.QueryResult, err error) {
	result = model.QueryResult{Columns: []model.ResultColumn{}, Rows: [][]any{}, IsQuery: len(types) > 0}
	for _, column := range types {
		result.Columns = append(result.Columns, model.ResultColumn{Name: column.Name(), Type: column.DatabaseTypeName()})
	}
	for rows.Next() {
		if budget.rows == 0 {
			result.Truncated = true
			result.TruncatedBy = model.QueryRowLimit
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
		size := 0
		if budget.chargeRowSlots {
			size = 24 + 16*len(types)
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
		if size > budget.bytes {
			result.OmitOversizedRow(values)
			budget.bytes = 0
			break
		}
		budget.bytes -= size
		if budget.rows > 0 {
			budget.rows--
		}
		result.Rows = append(result.Rows, values)
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	result.RowCount = len(result.Rows)
	return result, nil
}
