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

const (
	defaultRowLimit      = 1000
	maxRowLimit          = 5000
	maxConcurrentQueries = 4
	queryTimeout         = 30 * time.Second
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
