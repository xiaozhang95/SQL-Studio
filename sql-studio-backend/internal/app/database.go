package app

import (
	"context"
	"sql-studio-backend/internal/database"
	"sql-studio-backend/internal/greptimedb"
	"sql-studio-backend/internal/mariadb"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/databasesync"
	"sql-studio-backend/internal/mysql"
	"sql-studio-backend/internal/postgresql"
	"sql-studio-backend/internal/redis"
)

type workspaceDatabase struct {
	*database.Client
	redis *redis.Client
}

func (d workspaceDatabase) Test(ctx context.Context, c model.Connection) (string, error) {
	if c.Type == model.TypeRedis {
		return d.redis.Test(ctx, c)
	}
	return d.Client.Test(ctx, c)
}

func (d workspaceDatabase) Databases(ctx context.Context, c model.Connection) ([]string, error) {
	if c.Type == model.TypeRedis {
		return d.redis.Databases(ctx, c)
	}
	return d.Client.Databases(ctx, c)
}

func (d workspaceDatabase) SetSession(ctx context.Context, c model.Connection, db *string, open bool) error {
	if c.Type != model.TypeRedis {
		return d.Client.SetSession(ctx, c, db, open)
	}
	return d.redis.SetSession(ctx, c, db, open)
}

func (d workspaceDatabase) Monitor(ctx context.Context, c model.Connection, db string) (model.MonitorSnapshot, error) {
	if c.Type == model.TypeRedis {
		return d.redis.Monitor(ctx, c, db)
	}
	return d.Client.Monitor(ctx, c, db)
}

// Each caller owns its engine lifecycle state. Physical connections are scoped
// to individual engine operations and never retained by this registry.
func newDatabaseClient() *database.Client {
	return database.New(map[string]database.Engine{
		model.TypeMySQL:      mysql.NewClient(),
		model.TypeMariaDB:    mariadb.NewClient(),
		model.TypePostgreSQL: postgresql.NewClient(),
		model.TypeGreptimeDB: greptimedb.NewClient(),
	})
}

func syncDatabaseEngines() map[string]databasesync.Engine {
	return map[string]databasesync.Engine{
		model.TypeMySQL:      mysql.NewClient(),
		model.TypeMariaDB:    mariadb.NewClient(),
		model.TypePostgreSQL: postgresql.NewClient(),
		model.TypeGreptimeDB: greptimedb.NewClient(),
	}
}
