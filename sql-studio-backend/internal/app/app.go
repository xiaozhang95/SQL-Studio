// Package app 是组合根：只有这里知道具体存储、MySQL 客户端和 HTTP 服务如何装配。
package app

import (
	"context"
	"errors"
	"net"
	"net/http"
	"path/filepath"
	"sql-studio-backend/internal/modules/settings"
	"sql-studio-backend/internal/modules/workspace"
	"sql-studio-backend/internal/statefile"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/config"
	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/database"
	"sql-studio-backend/internal/deepseek"
	"sql-studio-backend/internal/httpapi"
	"sql-studio-backend/internal/mariadb"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/ai"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/mysql"
	"sql-studio-backend/internal/postgresql"
)

type App struct{ server *http.Server }

func New(cfg config.Config) (*App, error) {
	if err := connection.Migrate(cfg.LegacyDataDir, cfg.DataDir); err != nil {
		return nil, err
	}
	repository, err := connection.Open(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	client := database.New(map[string]database.Engine{model.TypeMySQL: mysql.NewClient(), model.TypeMariaDB: mariadb.NewClient(), model.TypePostgreSQL: postgresql.NewClient()})
	connectionService := connections.New(repository, client)
	// 首次初始化走同一业务校验，已有连接保持不变。
	if len(connectionService.ListConnections()) == 0 && cfg.InitialConnection != nil {
		if _, err = connectionService.SaveConnection(*cfg.InitialConnection); err != nil {
			return nil, err
		}
	}
	stateDir := cfg.StateDir
	if stateDir == "" {
		stateDir = filepath.Join(cfg.DataDir, "state")
	}
	stateStore, err := statefile.Open(stateDir)
	if err != nil {
		return nil, err
	}
	router := httpapi.New(httpapi.Services{
		Workspace:   workspace.New(stateStore),
		Connections: connectionService,
		AI:          ai.New(stateStore, repository, deepseek.New()),
		Settings:    settings.New(stateStore),
		Metadata:    metadata.New(repository, client),
		Queries:     query.New(repository, client),
	})
	web := http.FileServer(http.Dir(cfg.WebDir))
	router.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"error": "接口不存在"})
			return
		}
		web.ServeHTTP(c.Writer, c.Request)
	})
	server := &http.Server{Addr: cfg.Address, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 40 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	return &App{server: server}, nil
}

// Run 在收到退出信号时等待在途请求；超过宽限时间则关闭残留连接。
func (a *App) Run(ctx context.Context) error {
	listener, err := net.Listen("tcp", a.server.Addr)
	if err != nil {
		return err
	}
	finished := make(chan error, 1)
	go func() { finished <- a.server.Serve(listener) }()
	select {
	case err = <-finished:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err = a.server.Shutdown(shutdownCtx); err != nil {
			_ = a.server.Close()
			return err
		}
		return nil
	}
}
