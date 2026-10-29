package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"

	"sql-studio-backend/internal/app"
	"sql-studio-backend/internal/config"
)

// 后端根目录的唯一启动入口只加载配置、装配应用和处理退出信号，具体业务均在 internal 中。
func main() {
	gin.SetMode(gin.ReleaseMode)
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	executable, _ := os.Executable()
	log.Printf("SQL Studio PID: %d\nExecutable: %s\nListen address: %s\nState directory: %s", os.Getpid(), executable, cfg.Address, cfg.StateDir)
	application, err := app.New(cfg)
	if err != nil {
		log.Fatal(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	log.Printf("SQL Studio: http://%s\nData directory: %s\nState directory: %s", cfg.Address, cfg.DataDir, cfg.StateDir)
	if err = application.Run(ctx); err != nil {
		log.Fatal(err)
	}
}
