// Package mysql 实现 MySQL 连接、元数据读取和 SQL 执行，不依赖 HTTP 或文件存储。
package mysql

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"strconv"
	"time"

	"github.com/go-sql-driver/mysql"
	"sqldesk/internal/model"
)

// Client 每次请求使用独立连接，避免不同查询之间共享会话状态。
type Client struct{}

func NewClient() *Client { return &Client{} }

// Open 集中维护底层连接参数，业务代码应使用 Client 的请求方法。
func Open(c model.Connection, schema string) (*sql.DB, error) {
	cfg, err := driverConfig(c, schema)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(0)
	return db, nil
}

func driverConfig(c model.Connection, schema string) (*mysql.Config, error) {
	if !model.IsMySQL(c.Type) {
		return nil, errors.New("不支持的数据库类型")
	}
	cfg := mysql.NewConfig()
	cfg.User = c.Username
	cfg.Passwd = c.Password
	cfg.Net = "tcp"
	cfg.Addr = net.JoinHostPort(c.Host, strconv.Itoa(c.Port))
	cfg.DBName = schema
	cfg.Timeout = 5 * time.Second
	cfg.ReadTimeout = 35 * time.Second
	cfg.WriteTimeout = 10 * time.Second
	cfg.MultiStatements = false
	cfg.AllowNativePasswords = true
	cfg.Params = map[string]string{"charset": "utf8mb4"}
	if c.TLS {
		cfg.TLSConfig = "true"
	}
	return cfg, nil
}

func (c *Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	db, err := Open(connection, "")
	if err != nil {
		return "", err
	}
	defer db.Close()
	if err = db.PingContext(ctx); err != nil {
		return "", err
	}
	var version string
	err = db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
	return version, err
}
