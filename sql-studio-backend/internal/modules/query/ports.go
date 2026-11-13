package query

import (
	"context"
	"errors"
	"time"

	"sql-studio-backend/internal/model"
)

type Connections interface {
	Get(string) (model.Connection, error)
}

type Executor interface {
	Execute(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}

type batchExecutor interface {
	ExecuteBatch(context.Context, model.Connection, model.QueryBatchRequest, time.Duration, func(model.QueryBatchStep) error) error
}

const (
	defaultRowLimit      = 1000
	maxRowLimit          = 5000
	maxConcurrentQueries = 4
	queryTimeout         = 30 * time.Second
	batchTimeout         = 30 * time.Minute
	maxBatchStatements   = 10000
)

var ErrBusy = errors.New("当前查询较多，请稍后重试")

type Service struct {
	connections Connections
	database    Executor
	querySlots  chan struct{}
}

// New 在应用启动时调用一次，使所有 HTTP 查询共用同一并发预算。
func New(repository Connections, executor Executor) *Service {
	return &Service{connections: repository, database: executor, querySlots: make(chan struct{}, maxConcurrentQueries)}
}

// WithExecutor creates a scope using the supplied executor while sharing the
// original credential source and process query budget.
// Configure scopes at startup; this does not mutate the original service.
func (s *Service) WithExecutor(executor Executor) *Service {
	return &Service{connections: s.connections, database: executor, querySlots: s.querySlots}
}
