package query

import (
	"context"
	"errors"
	"strings"

	"sql-studio-backend/internal/model"
)

// Query 在业务层统一限流、行数与超时，避免 HTTP 以外的调用绕过相同约束。
func (s *Service) Query(ctx context.Context, id string, input model.QueryRequest) (model.QueryResult, error) {
	if strings.TrimSpace(input.SQL) == "" {
		return model.QueryResult{}, errors.New("SQL 不能为空")
	}
	input.Limit = rowLimit(input.Limit)
	select {
	case s.querySlots <- struct{}{}:
		defer func() { <-s.querySlots }()
	default:
		return model.QueryResult{}, ErrBusy
	}
	c, err := s.connections.Get(id)
	if err != nil {
		return model.QueryResult{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, queryTimeout)
	defer cancel()
	return s.database.Execute(ctx, c, input)
}

func rowLimit(limit int) int {
	if limit <= 0 {
		return defaultRowLimit
	}
	return min(limit, maxRowLimit)
}

// Batch is the explicit workspace write path. It owns one shared query slot
// until the driver has released the session, including on stream cancellation.
func (s *Service) Batch(ctx context.Context, id string, input model.QueryBatchRequest, emit func(model.QueryBatchStep) error) error {
	if !input.AllowWrite {
		return errors.New("批量 SQL 执行需要显式允许写入")
	}
	if len(input.Statements) == 0 || len(input.Statements) > maxBatchStatements {
		return errors.New("SQL 批次需要 1 至 10000 条语句")
	}
	for _, statement := range input.Statements {
		if strings.TrimSpace(statement) == "" {
			return errors.New("SQL 不能为空")
		}
	}
	executor, ok := s.database.(batchExecutor)
	if !ok {
		return errors.New("该引擎不支持同一会话批量执行")
	}
	select {
	case s.querySlots <- struct{}{}:
		defer func() { <-s.querySlots }()
	default:
		return ErrBusy
	}
	connection, err := s.connections.Get(id)
	if err != nil {
		return err
	}
	input.Limit = rowLimit(input.Limit)
	ctx, cancel := context.WithTimeout(ctx, batchTimeout)
	defer cancel()
	return executor.ExecuteBatch(ctx, connection, input, queryTimeout, emit)
}
