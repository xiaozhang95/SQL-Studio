package oracle

import (
	"context"
	"database/sql"
	"errors"
	"net"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	driver "github.com/sijms/go-ora/v2"

	"sql-studio-backend/internal/model"
)

const defaultService = model.DefaultOracleService

var hostName = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

type Client struct {
	mu      sync.Mutex
	control chan struct{}
	active  map[*requestLease]bool
	closed  map[string]bool
	closing map[string]bool
}

func NewClient() *Client {
	return &Client{
		control: make(chan struct{}, 1),
		active:  make(map[*requestLease]bool),
		closed:  make(map[string]bool),
		closing: make(map[string]bool),
	}
}

func configuredService(connection model.Connection, selected string) (string, error) {
	service := connection.Database
	if service == "" {
		service = defaultService
	}
	if selected != "" && selected != service {
		return "", errors.New("请选择该 Oracle 连接配置的服务名")
	}
	return service, nil
}

func openConnection(connection model.Connection, selected string) (*requestDB, error) {
	service, err := configuredService(connection, selected)
	if err != nil {
		return nil, err
	}
	host := strings.TrimSpace(connection.Host)
	if strings.HasPrefix(host, "[") && strings.HasSuffix(host, "]") {
		host = host[1 : len(host)-1]
	}
	ip, ipErr := netip.ParseAddr(host)
	if connection.Type != model.TypeOracle || !model.ValidOracleService(service) ||
		connection.Port < 1 || connection.Port > 65535 || (!hostName.MatchString(host) && (ipErr != nil || ip.Zone() != "")) {
		return nil, errors.New("Oracle 主机、端口或服务名无效")
	}
	options := url.Values{"CONNECTION TIMEOUT": {"5"}, "LOB FETCH": {"POST"}, "PREFETCH_ROWS": {"10"}}
	if connection.TLS {
		options.Set("SSL", "enable")
		options.Set("SSL VERIFY", "true")
	}
	address := url.URL{Scheme: "oracle", Host: net.JoinHostPort(host, strconv.Itoa(connection.Port)),
		User: url.UserPassword(connection.Username, connection.Password), Path: "/" + service, RawQuery: options.Encode()}
	dsn := address.String()
	if _, err := driver.ParseConfig(dsn); err != nil {
		return nil, errors.New("Oracle 连接参数无效")
	}
	connector := driver.NewConnector(dsn).(*driver.OracleConnector)
	dialer := &requestDialer{dialer: net.Dialer{Timeout: 5 * time.Second}}
	connector.Dialer(dialer)
	db := sql.OpenDB(connector)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	return &requestDB{DB: db, dialer: dialer}, nil
}

type requestDB struct {
	*sql.DB
	dialer *requestDialer
}

func (db *requestDB) interruptOnCancel(ctx context.Context) func() bool {
	return context.AfterFunc(ctx, db.dialer.abort)
}

// Oracle's protocol cancellation can be ignored by a network tunnel. A
// canceled request also closes its private transport and prevents redial.
type requestDialer struct {
	dialer  net.Dialer
	mu      sync.Mutex
	socket  net.Conn
	aborted bool
}

func (d *requestDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	conn, err := d.dialer.DialContext(ctx, network, address)
	if err != nil {
		return nil, err
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.aborted {
		_ = conn.Close()
		return nil, context.Canceled
	}
	d.socket = conn
	return conn, nil
}

func (d *requestDialer) abort() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.aborted = true
	if d.socket != nil {
		_ = d.socket.Close()
		d.socket = nil
	}
}

func (c *Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	ctx, db, release, err := c.openScopedRequest(ctx, connection, "", true)
	if err != nil {
		return "", err
	}
	defer release()
	var version string
	err = db.QueryRowContext(ctx, versionSQL).Scan(&version)
	return version, err
}

const versionSQL = "SELECT VERSION_FULL FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE 'Oracle%Database%' FETCH FIRST 1 ROW ONLY"
