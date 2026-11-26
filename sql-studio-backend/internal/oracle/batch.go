package oracle

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"strings"
	"time"

	"sql-studio-backend/internal/model"
)

var errIncompleteTransaction = errors.New("Oracle 批次未提交事务，未提交的更改已回滚")

type batchStatement struct {
	text    string
	tokens  []sqlToken
	control string
	err     error
}

func (c *Client) ExecuteBatch(ctx context.Context, connection model.Connection, input model.QueryBatchRequest, timeout time.Duration, emit func(model.QueryBatchStep) error) error {
	if !input.AllowWrite {
		return errors.New("批量 SQL 执行需要显式允许写入")
	}
	statements := make([]batchStatement, len(input.Statements))
	manual := false
	for i, text := range input.Statements {
		normalized, tokens, err := normalizedStatement(text)
		statements[i] = batchStatement{text: normalized, tokens: tokens, err: err}
		if err == nil {
			statements[i].control = transactionControl(tokens)
			manual = manual || statements[i].control != ""
		}
	}
	if manual && len(statements) == 1 {
		return errTransactionNeedsBatch
	}
	ctx, db, release, err := c.openRequest(ctx, connection, input.Database)
	if err != nil {
		return err
	}
	defer release()
	setupCtx, cancelSetup := context.WithTimeoutCause(ctx, timeout, model.QuerySessionTimeout)
	stopSetup := db.interruptOnCancel(setupCtx)
	conn, err := db.Conn(setupCtx)
	if err == nil {
		defer conn.Close()
		err = setSchema(setupCtx, conn, input.Schema)
	}
	if setupCtx.Err() != nil {
		err = setupCtx.Err()
	}
	err = model.QueryContextError(setupCtx, err)
	stopSetup()
	cancelSetup()
	if err != nil {
		return err
	}
	session := batchSession{ctx: ctx, conn: conn, manual: manual}
	defer func() {
		if session.tx != nil {
			_ = session.tx.Rollback()
		}
	}()
	for i, statement := range statements {
		if err = ctx.Err(); err != nil {
			return err
		}
		stepCtx, cancelStep := context.WithTimeoutCause(ctx, timeout, model.QueryStatementTimeout)
		stopStep := db.interruptOnCancel(stepCtx)
		result, err := session.run(stepCtx, statement, input.Limit)
		if stepCtx.Err() != nil {
			err = stepCtx.Err()
		}
		err = model.QueryContextError(stepCtx, err)
		stopStep()
		cancelStep()
		step := model.QueryBatchStep{Index: i, Result: &result}
		if err != nil {
			step.Result, step.Error, step.StatementError = nil, err.Error(), model.IsStatementError(statementError(err))
		}
		if emitErr := emit(step); emitErr != nil {
			return emitErr
		}
		if err != nil {
			return nil
		}
	}
	if session.tx != nil {
		if err := session.tx.Rollback(); err != nil {
			return err
		}
		session.tx = nil
		return errIncompleteTransaction
	}
	return nil
}

type batchSession struct {
	ctx    context.Context
	conn   *sql.Conn
	tx     *sql.Tx
	manual bool
}

func (s *batchSession) run(ctx context.Context, statement batchStatement, limit int) (model.QueryResult, error) {
	if statement.err != nil {
		return model.QueryResult{}, statement.err
	}
	query := selectStatement(statement.tokens)
	if !s.manual {
		return runStatement(ctx, s.conn, statement.text, query, limit)
	}
	words := make([]string, len(statement.tokens))
	for i, token := range statement.tokens {
		words[i] = token.word
	}
	if statement.control == "SET TRANSACTION" {
		if s.tx != nil {
			return model.QueryResult{}, &model.StatementError{Cause: errors.New("SET TRANSACTION 必须位于 Oracle 事务开头")}
		}
		switch strings.Join(words[2:], " ") {
		case "READ ONLY", "READ WRITE", "ISOLATION LEVEL READ COMMITTED", "ISOLATION LEVEL SERIALIZABLE":
		default:
			return model.QueryResult{}, &model.StatementError{Cause: errors.New("不支持此 Oracle SET TRANSACTION 选项")}
		}
		var err error
		s.tx, err = s.conn.BeginTx(s.ctx, nil)
		if err != nil {
			return model.QueryResult{}, err
		}
		return runStatement(ctx, s.tx, statement.text, false, limit)
	}
	commit := slices.Equal(words, []string{"COMMIT"}) || slices.Equal(words, []string{"COMMIT", "WORK"})
	rollback := slices.Equal(words, []string{"ROLLBACK"}) || slices.Equal(words, []string{"ROLLBACK", "WORK"})
	if commit || rollback {
		if s.tx == nil {
			return emptyResult(), nil
		}
		tx := s.tx
		s.tx = nil
		if err := ctx.Err(); err != nil {
			_ = tx.Rollback()
			return model.QueryResult{}, err
		}
		if commit {
			return emptyResult(), tx.Commit()
		}
		return emptyResult(), tx.Rollback()
	}
	if statement.control == "COMMIT" || (statement.control == "ROLLBACK" && !slices.Contains(words, "TO")) {
		return model.QueryResult{}, &model.StatementError{Cause: errors.New("请使用 COMMIT、ROLLBACK 或 ROLLBACK TO 保存点")}
	}
	if s.tx == nil && query && readOnlySelect(statement.tokens) {
		return runStatement(ctx, s.conn, statement.text, true, limit)
	}
	if s.tx == nil {
		var err error
		s.tx, err = s.conn.BeginTx(s.ctx, nil)
		if err != nil {
			return model.QueryResult{}, err
		}
	}
	return runStatement(ctx, s.tx, statement.text, query, limit)
}

func emptyResult() model.QueryResult {
	return model.QueryResult{Columns: []model.ResultColumn{}, Rows: [][]any{}}
}
