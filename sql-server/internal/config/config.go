// Package config 集中读取启动参数，不创建服务、不访问数据库。
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"sqldesk/internal/model"
)

type Config struct {
	Address           string
	DataDir           string
	WebDir            string
	InitialConnection *model.Connection
}

// Load 将相对目录解析为绝对路径；原生命令以 sql-server 为工作目录，兼容已有数据位置。
func Load() (Config, error) {
	cfg := Config{Address: "127.0.0.1:8080"}
	var err error
	cfg.DataDir, err = resolveDirectory("SQLDESK_DATA_DIR", "data")
	if err != nil {
		return cfg, err
	}
	cfg.WebDir, err = resolveDirectory("SQLDESK_WEB_DIR", "../sql-web/dist")
	if err != nil {
		return cfg, err
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
