// Package config 集中读取启动参数，不创建服务、不访问数据库。
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"sql-studio-backend/internal/model"
)

type Config struct {
	Address           string
	DataDir           string
	LegacyDataDir     string
	StateDir          string
	WebDir            string
	InitialConnection *model.Connection
}

// Load resolves paths against the service startup working directory, independently of the executable location.
func Load() (Config, error) {
	cfg := Config{Address: "127.0.0.1:18080"}
	if address := os.Getenv("SQLDESK_ADDR"); address != "" {
		cfg.Address = address
	}
	var err error
	cfg.StateDir, err = resolveDirectory("SQLDESK_STATE_DIR", filepath.Join(".sql-studio", "state"))
	if err != nil {
		return cfg, err
	}
	// 连接与密钥跟随同一启动目录；显式目录覆盖保持原有语义。
	cfg.DataDir, err = resolveDirectory("SQLDESK_DATA_DIR", cfg.StateDir)
	if err != nil {
		return cfg, err
	}
	if os.Getenv("SQLDESK_DATA_DIR") == "" {
		cfg.LegacyDataDir, err = filepath.Abs("data")
		if err != nil {
			return cfg, err
		}
	}
	// Empty means the build's default frontend source; only an explicit override uses disk.
	if os.Getenv("SQLDESK_WEB_DIR") != "" {
		cfg.WebDir, err = resolveDirectory("SQLDESK_WEB_DIR", "")
		if err != nil {
			return cfg, err
		}
	}
	if password := os.Getenv("SQLDESK_MYSQL_PASSWORD"); password != "" {
		host := os.Getenv("SQLDESK_MYSQL_HOST")
		if host == "" {
			host = "127.0.0.1"
		}
		port := 3306
		if value := os.Getenv("SQLDESK_MYSQL_PORT"); value != "" {
			port, err = strconv.Atoi(value)
			if err != nil || port < 1 || port > 65535 {
				return cfg, fmt.Errorf("SQLDESK_MYSQL_PORT 必须是 1–65535 之间的端口")
			}
		}
		cfg.InitialConnection = &model.Connection{Name: "本地 MySQL", Host: host, Port: port, Username: "root", Password: password}
	}
	return cfg, nil
}

func resolveDirectory(key, fallback string) (string, error) {
	value := os.Getenv(key)
	if value == "" {
		value = fallback
	}
	path, err := filepath.Abs(value)
	if err != nil {
		return "", fmt.Errorf("解析 %s 目录失败: %w", key, err)
	}
	return path, nil
}
