package postgresql

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/stdlib"

	"sql-studio-backend/internal/model"
)

// ExecuteBatch keeps one physical connection for the script and drops the session when it ends.
func (c *Client) ExecuteBatch(ctx context.Context, connection model.Connection, input model.QueryBatchRequest, timeout time.Duration, emit func(model.QueryBatchStep) error) error {
	if !input.AllowWrite {
		return errors.New("批量 SQL 执行需要显式允许写入")
	}
	if len(input.Statements) == 1 && transactionControl(input.Statements[0]) {
		return errTransactionNeedsBatch
	}
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return err
	}
	defer release()
	setupCtx, cancelSetup := context.WithTimeoutCause(ctx, timeout, model.QuerySessionTimeout)
	conn, err := db.Conn(setupCtx)
	if err != nil {
		err = model.QueryContextError(setupCtx, err)
		cancelSetup()
		return err
	}
	defer conn.Close()
	err = model.QueryContextError(setupCtx, setQuerySchema(setupCtx, conn, input.Schema))
	cancelSetup()
	if err != nil {
		return err
	}
	for index, statement := range input.Statements {
		if err := ctx.Err(); err != nil {
			return err
		}
		statementCtx, cancelStatement := context.WithTimeoutCause(ctx, timeout, model.QueryStatementTimeout)
		result, err := executeQuery(statementCtx, conn, statement, input.Limit, true, true)
		err = model.QueryContextError(statementCtx, err)
		cancelStatement()
		step := model.QueryBatchStep{Index: index}
		if err != nil {
			step.Error = err.Error()
			step.StatementError = model.IsStatementError(markStatementError(err))
		} else {
			step.Result = &result
		}
		if emitErr := emit(step); emitErr != nil {
			return emitErr
		}
		if err != nil {
			return nil
		}
	}
	return conn.Raw(func(driverConn any) error {
		switch driverConn.(*stdlib.Conn).Conn().PgConn().TxStatus() {
		case 'T', 'E':
			return errors.New("SQL 批次未结束 PostgreSQL 事务，未提交的更改已回滚")
		}
		return nil
	})
}
