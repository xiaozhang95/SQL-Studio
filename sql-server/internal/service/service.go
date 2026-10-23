// Package service 编排业务流程，通过接口依赖存储和数据库，不依赖 HTTP 或具体驱动。
package service

import (
	"context"
	"errors"
	"time"

	"sqldesk/internal/model"
)

// ConnectionRepository 的 Get 仅供服务端获取解密凭据；List / Save 返回公开连接信息。
type ConnectionRepository interface {
	List() []model.Connection
	Get(string) (model.Connection, error)
	Save(model.Connection) (model.Connection, error)
	Delete(string) error
}

type Database interface {
	Test(context.Context, model.Connection) (string, error)
	Databases(context.Context, model.Connection) ([]string, error)
	Tables(context.Context, model.Connection, string) ([]model.Table, error)
	Columns(context.Context, model.Connection, model.TableRef) ([]model.Column, error)
	DDL(context.Context, model.Connection, model.TableRef) (string, error)
	Execute(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}

const (
	defaultRowLimit      = 1000
	maxRowLimit          = 5000
	maxConcurrentQueries = 4
	queryTimeout         = 30 * time.Second
	metadataTimeout      = 10 * time.Second
	connectionTimeout    = 7 * time.Second
)

var ErrBusy = errors.New("当前查询较多，请稍后重试")

type Service struct {
	connections ConnectionRepository
	database    Database
	querySlots  chan struct{}
}

func New(connections ConnectionRepository, database Database) *Service {
	return &Service{connections: connections, database: database, querySlots: make(chan struct{}, maxConcurrentQueries)}
}
