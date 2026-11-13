package mysql

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"sql-studio-backend/internal/model"
)

// ExecuteBatch runs individually submitted statements on one private session.
// The driver keeps protocol-level multi-statements disabled.
func (c *Client) ExecuteBatch(ctx context.Context, connection model.Connection, input model.QueryBatchRequest, timeout time.Duration, emit func(model.QueryBatchStep) error) error {
	if !input.AllowWrite {
		return errors.New("批量 SQL 执行需要显式允许写入")
	}
	ctx, db, lease, release, err := c.openLeasedRequest(ctx, connection, input.Database, false)
	if err != nil {
		return err
	}
	defer release()
	connectCtx, cancelConnect := context.WithTimeout(ctx, timeout)
	conn, err := db.Conn(connectCtx)
	cancelConnect()
	if err != nil {
		return err
	}
	defer conn.Close()
	for index, statement := range input.Statements {
		if err := ctx.Err(); err != nil {
			return err
		}
		returnsRows := isQuery(statement) || (connection.Type == model.TypeMariaDB && hasReturning(statement))
		step := c.batchStep(ctx, conn, lease, index, statement, input.Limit, timeout, returnsRows)
		if err := emit(step); err != nil {
			return err
		}
		if step.Error != "" {
			return nil
		}
	}
	return nil
}

func (c *Client) batchStep(ctx context.Context, conn *sql.Conn, lease *requestLease, index int, statement string, limit int, timeout time.Duration, returnsRows bool) model.QueryBatchStep {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	started := time.Now()
	step := model.QueryBatchStep{Index: index}
	var result model.QueryResult
	var err error
	if returnsRows {
		result, err = scanRows(ctx, conn, statement, limit, started, true)
	} else {
		result, err = execStatement(ctx, conn, statement)
		if err == nil && firstKeyword(statement) == "USE" {
			var database string
			err = conn.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&database)
			if err == nil {
				c.mu.Lock()
				key := sessionKey(lease.id, &database)
				if c.closed[key] || c.closing[key] {
					err = errors.New("连接或数据库已关闭，请重新打开")
				} else {
					lease.database = database
					step.Database = &database
				}
				c.mu.Unlock()
			}
		}
	}
	result.DurationMS = time.Since(started).Milliseconds()
	if err != nil {
		step.Error = err.Error()
		return step
	}
	step.Result = &result
	return step
}
