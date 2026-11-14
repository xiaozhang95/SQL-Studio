package app

import (
	"sql-studio-backend/internal/database"
	"sql-studio-backend/internal/greptimedb"
	"sql-studio-backend/internal/mariadb"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/databasesync"
	"sql-studio-backend/internal/mysql"
	"sql-studio-backend/internal/postgresql"
)

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
