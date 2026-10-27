package metadata

import (
	"context"
	"time"

	"sql-studio-backend/internal/model"
)

// Connections 仅允许按显式连接 ID 取得元数据请求所需的凭据。
type Connections interface {
	Get(string) (model.Connection, error)
}

type Database interface {
	Databases(context.Context, model.Connection) ([]string, error)
	Tables(context.Context, model.Connection, string) ([]model.Table, error)
	Columns(context.Context, model.Connection, model.TableRef) ([]model.Column, error)
	DDL(context.Context, model.Connection, model.TableRef) (string, error)
}

const metadataTimeout = 10 * time.Second

type Service struct {
	connections Connections
	database    Database
}

func New(repository Connections, database Database) *Service {
	return &Service{connections: repository, database: database}
}
