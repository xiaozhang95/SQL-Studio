package connections

import (
	"context"
	"time"

	"sql-studio-backend/internal/model"
)

// Repository 的 Get 只供服务端读取凭据；List 和 Save 返回脱敏信息。
type Repository interface {
	List() []model.Connection
	Get(string) (model.Connection, error)
	Save(model.Connection) (model.Connection, error)
	Delete(string) error
}

// Database 只暴露连接管理所需的连通性测试。
type Database interface {
	Test(context.Context, model.Connection) (string, error)
}

const connectionTimeout = 7 * time.Second

type Service struct {
	connections Repository
	database    Database
}

func New(repository Repository, database Database) *Service {
	return &Service{connections: repository, database: database}
}
