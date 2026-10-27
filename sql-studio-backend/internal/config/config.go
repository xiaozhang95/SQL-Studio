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

// Load 将相对目录解析为绝对路径；默认使用用户状态目录，旧 data 交由 app 迁移。
func Load() (Config, error) {
	cfg := Config{Address: "127.0.0.1:8080"}
	var err error
	home, homeErr := os.UserHomeDir()
	if homeErr != nil {
		return cfg, homeErr
	}
	cfg.StateDir, err = resolveDirectory("SQLDESK_STATE_DIR", defaultStateDirectory(home))
	if err != nil {
		return cfg, err
	}
	// 默认与布局/历史共用用户目录；显式数据目录保持原有含义，不自动搬移。
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
	cfg.WebDir, err = resolveDirectory("SQLDESK_WEB_DIR", "../sql-studio-frontend/dist")
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

// 新安装使用新名称，已有旧目录继续读取，不移动或覆盖用户配置。
func defaultStateDirectory(home string) string {
	current := filepath.Join(home, ".sql-studio", "state")
	if _, err := os.Stat(current); !os.IsNotExist(err) {
		return current
	}
	legacy := filepath.Join(home, ".sqloom", "state")
	if _, err := os.Stat(legacy); !os.IsNotExist(err) {
		return legacy
	}
	return current
}
