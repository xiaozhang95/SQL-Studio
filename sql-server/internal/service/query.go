package service

import (
	"context"
	"errors"
	"strings"

	"sqldesk/internal/model"
)

// Query 在业务层统一限流、行数与超时，避免 HTTP 以外的调用绕过相同约束。
func (s *Service) Query(ctx context.Context, id string, input model.QueryRequest) (model.QueryResult, error) {
	if strings.TrimSpace(input.SQL) == "" {
		return model.QueryResult{}, errors.New("SQL 不能为空")
	}
	if input.Limit <= 0 {
		input.Limit = defaultRowLimit
	}
	if input.Limit > maxRowLimit {
		input.Limit = maxRowLimit
	}
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
