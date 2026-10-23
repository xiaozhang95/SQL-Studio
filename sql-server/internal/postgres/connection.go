// Package postgres 实现 PostgreSQL 和 PolarDB PostgreSQL/Oracle 兼容版的协议访问。
package postgres

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"sqldesk/internal/model"
)

type Client struct{}

func NewClient() *Client { return &Client{} }

func driverConfig(c model.Connection, database, schema string) (*pgx.ConnConfig, error) {
	if !model.IsPostgres(c.Type) {
		return nil, errors.New("当前连接不是 PostgreSQL 兼容协议")
	}
	if database == "" {
		database = c.Database
	}
	if database == "" {
		database = "postgres"
	}
	mode := "disable"
	if c.TLS {
		mode = "verify-full"
	}
	parameters := url.Values{"sslmode": {mode}, "connect_timeout": {"5"}}
	endpoint := url.URL{Scheme: "postgres", Host: net.JoinHostPort(c.Host, strconv.Itoa(c.Port)), User: url.UserPassword(c.Username, c.Password), Path: "/" + database, RawQuery: parameters.Encode()}
	cfg, err := pgx.ParseConfig(endpoint.String())
	if err != nil {
		return nil, err
	}
	// 空密码也只使用表单值，不隐式复用 pgpass 中的其他凭据。
	cfg.Password = c.Password
	if schema != "" {
		cfg.RuntimeParams["search_path"] = quoteIdentifier(schema)
	}
	// 默认使用扩展查询协议，服务端拒绝同一请求中的多条 SQL。
	return cfg, nil
}

func Open(ctx context.Context, c model.Connection, database, schema string) (*pgx.Conn, error) {
	cfg, err := driverConfig(c, database, schema)
	if err != nil {
		return nil, err
	}
	return pgx.ConnectConfig(ctx, cfg)
}
func quoteIdentifier(value string) string { return `"` + strings.ReplaceAll(value, `"`, `""`) + `"` }
func tableSchema(ref model.TableRef) string {
	if ref.Schema != "" {
		return ref.Schema
	}
	return "public"
}

func (c *Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	conn, err := Open(ctx, connection, "", "")
	if err != nil {
		return "", err
	}
	defer conn.Close(context.Background())
	var version string
	err = conn.QueryRow(ctx, "SELECT version()").Scan(&version)
	return version, err
}
