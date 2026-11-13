// Package app 是组合根：只有这里知道具体存储、MySQL 客户端和 HTTP 服务如何装配。
package app

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	localstate "sql-studio-backend/internal/agentstate"
	agentstream "sql-studio-backend/internal/deepseek/agent"
	agent "sql-studio-backend/internal/modules/agent"
	agentlayout "sql-studio-backend/internal/modules/agentlayout"
	"sql-studio-backend/internal/modules/settings"
	"sql-studio-backend/internal/modules/workspace"
	"sql-studio-backend/internal/statefile"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/config"
	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/deepseek"
	"sql-studio-backend/internal/httpapi"
	"sql-studio-backend/internal/modules/ai"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/webui"
)

type App struct{ server *http.Server }

func New(cfg config.Config) (*App, error) {
	stateDir := cfg.StateDir
	if stateDir == "" || cfg.DataDir == "" {
		return nil, errors.New("必须提供当前状态目录和连接目录")
	}
	stateStore, err := statefile.Open(stateDir)
	if err != nil {
		return nil, err
	}
	repository, err := connection.Open(cfg.DataDir)
	if err != nil {
		return nil, err
	}
	client := newDatabaseClient()
	connectionService := connections.New(repository, client)
	// 首次初始化走同一业务校验，已有连接保持不变。
	if len(connectionService.ListConnections()) == 0 && cfg.InitialConnection != nil {
		if _, err = connectionService.SaveConnection(*cfg.InitialConnection); err != nil {
			return nil, err
		}
	}
	prefs := settings.New(stateStore)
	agentDir := filepath.Join(stateDir, "agent")
	agentStore := localstate.New(agentDir)
	metadataService := metadata.New(repository, client)
	queryService := query.New(repository, client)
	// Agent owns separate lifecycle state; each engine releases its physical
	// connection before a database operation returns, including errors/cancellation.
	agentClient := newDatabaseClient()
	agentService := agent.New(agentstream.New(agentCredentials{stateStore}), agentDatabase{
		connections: connectionService,
		metadata:    metadata.New(repository, agentClient),
		queries:     queryService.WithExecutor(agentClient),
	}, agentStore)
	router := httpapi.New(httpapi.Services{
		Agent:       agentService,
		AgentLayout: agentlayout.New(agentStore),
		Workspace:   workspace.New(stateStore),
		Connections: connectionService,
		AI:          ai.New(stateStore, repository, deepseek.New()),
		Settings:    prefs,
		Metadata:    metadataService,
		Queries:     queryService,
	})
	if err := webui.Register(router, cfg.WebDir); err != nil {
		return nil, err
	}
	router.HandleMethodNotAllowed = true
	router.NoRoute(func(c *gin.Context) {
		if c.Request.URL.Path == "/api" || strings.HasPrefix(c.Request.URL.Path, "/api/") {
			httpapi.NotFound(c)
			return
		}
		c.String(http.StatusNotFound, "404 page not found")
	})
	server := &http.Server{Addr: cfg.Address, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 40 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	return &App{server: server}, nil
}

// Run 在收到退出信号时等待在途请求；超过宽限时间则关闭残留连接。
func (a *App) Run(ctx context.Context) error {
	listener, err := net.Listen("tcp", a.server.Addr)
	if err != nil {
		return fmt.Errorf("SQL Studio 无法监听 %s，请检查该端口是否已被旧的 go run 或其他后端程序占用，以及监听地址是否有效: %w", a.server.Addr, err)
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
