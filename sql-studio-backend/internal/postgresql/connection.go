package postgresql

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"sql-studio-backend/internal/model"
)

// Client 每次请求使用独立连接，避免不同查询之间共享会话状态。
type Client struct {
	mu      sync.Mutex
	control chan struct{}
	active  map[*requestLease]bool
	closed  map[string]bool
	closing map[string]bool
	open    func(model.Connection, string) (*sql.DB, error)
}

func NewClient() *Client {
	return &Client{control: make(chan struct{}, 1), active: make(map[*requestLease]bool), closed: make(map[string]bool), closing: make(map[string]bool), open: Open}
}

// Open 集中维护底层连接参数，业务代码应使用 Client 的请求方法。
func Open(c model.Connection, schema string) (*sql.DB, error) {
	cfg, err := driverConfig(c, schema)
	if err != nil {
		return nil, err
	}
	db := stdlib.OpenDB(*cfg)
	db.SetMaxOpenConns(2)
	db.SetMaxIdleConns(0)
	return db, nil
}

func driverConfig(c model.Connection, database string) (*pgx.ConnConfig, error) {
	if model.NormalizeDatabaseType(c.Type) != model.TypePostgreSQL {
		return nil, errors.New("不支持的数据库类型")
	}
	if database == "" {
		database = c.Database
	}
	if database == "" {
		database = "postgres"
	}
	address := &url.URL{Scheme: "postgresql", Host: net.JoinHostPort(c.Host, strconv.Itoa(c.Port)), User: url.UserPassword(c.Username, c.Password), Path: "/" + database}
	params := url.Values{"connect_timeout": {"5"}, "sslmode": {"disable"}}
	if c.TLS {
		params.Set("sslmode", "verify-full")
	}
	address.RawQuery = params.Encode()
	cfg, err := pgx.ParseConfig(address.String())
	if err != nil {
		return nil, errors.New("PostgreSQL 连接参数无效")
	}
	cfg.Password = c.Password
	cfg.User = c.Username
	cfg.Database = database
	cfg.ConnectTimeout = 5 * time.Second
	// Reads use extended protocol; command execution additionally prepares its single statement.
	cfg.DefaultQueryExecMode = pgx.QueryExecModeExec
	cfg.RuntimeParams = map[string]string{"application_name": "SQL Studio", "standard_conforming_strings": "on", "client_encoding": "UTF8"}
	return cfg, nil
}

func (c *Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	ctx, db, release, err := c.openScopedRequest(ctx, connection, "", true)
	if err != nil {
		return "", err
	}
	defer release()
	if err = db.PingContext(ctx); err != nil {
		return "", err
	}
	var version string
	err = db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version)
	return version, err
}
