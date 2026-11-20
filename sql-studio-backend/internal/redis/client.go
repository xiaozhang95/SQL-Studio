package redis

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

type Client struct {
	mu      sync.Mutex
	control chan struct{}
	closed  map[redisScope]bool
	active  map[*requestLease]struct{}
	pools   map[redisScope]*pooledClient
}

func NewClient() *Client {
	return &Client{
		control: make(chan struct{}, 1),
		closed:  make(map[redisScope]bool),
		active:  make(map[*requestLease]struct{}),
		pools:   make(map[redisScope]*pooledClient),
	}
}

func newRedisClient(connection model.Connection, db int, poolSize int) driver.UniversalClient {
	host := strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(connection.Host), "]"), "[")
	mode := connection.RedisModeValue()
	addr := net.JoinHostPort(host, strconv.Itoa(connection.Port))
	options := &driver.UniversalOptions{
		Addrs:    []string{addr},
		Username: connection.Username, Password: connection.Password, DB: db,
		Protocol: 2, DisableIdentity: true, ContextTimeoutEnabled: true,
		MaxRetries: -1, DialerRetries: 1,
		PoolSize:    poolSize,
		DialTimeout: 4 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second,
	}
	if poolSize > 1 {
		options.MaxActiveConns = poolSize
		options.ConnMaxIdleTime = redisPoolIdle
	}
	switch mode {
	case model.RedisSentinel:
		options.MasterName = connection.RedisMasterName
		options.SentinelUsername, options.SentinelPassword = connection.RedisSentinelUsername, connection.RedisSentinelPassword
		options.Addrs = append(options.Addrs, connection.RedisNodes...)
		options.DialTimeout = time.Second
	case model.RedisCluster:
		options.Addrs = append(options.Addrs, connection.RedisNodes...)
	}
	if mode != model.RedisSentinel && connection.Username != "" && connection.Password == "" {
		// Explicitly select an ACL user even when it was configured with nopass.
		options.DB = 0
		options.OnConnect = func(ctx context.Context, conn *driver.Conn) error {
			if err := conn.AuthACL(ctx, connection.Username, "").Err(); err != nil {
				return err
			}
			if db > 0 {
				return conn.Select(ctx, db).Err()
			}
			return nil
		}
	}
	if connection.TLS {
		options.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
		if mode == model.RedisStandalone {
			options.TLSConfig.ServerName = host
		}
	}
	switch mode {
	case model.RedisSentinel:
		return driver.NewFailoverClient(options.Failover())
	case model.RedisCluster:
		cluster := options.Cluster()
		if poolSize > 1 {
			// A reused client can otherwise keep a failed primary in its
			// routing table for the driver's default one-minute interval.
			cluster.ClusterStateReloadInterval = 3 * time.Second
		}
		return driver.NewClusterClient(cluster)
	default:
		return driver.NewClient(options.Simple())
	}
}

func open(ctx context.Context, connection model.Connection, db int) (driver.UniversalClient, func()) {
	client := newRedisClient(connection, db, 1)
	var once sync.Once
	closeClient := func() {
		once.Do(func() { _ = client.Close() })
	}
	// go-redis applies deadlines to socket reads. Close this request's client
	// on cancellation to also interrupt Redis commands already blocked in a read.
	stop := context.AfterFunc(ctx, closeClient)
	return client, func() {
		stop()
		closeClient()
	}
}

func keyedCommand(ctx context.Context, client driver.UniversalClient, command, key string, args ...any) *driver.Cmd {
	cmd := driver.NewCmd(ctx, append([]any{command, key}, args...)...)
	cmd.SetFirstKeyPos(1)
	_ = client.Process(ctx, cmd)
	return cmd
}

func (*Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	db := 0
	if connection.Database != "" {
		number, err := strconv.ParseUint(connection.Database, 10, 31)
		if err != nil {
			return "", errors.New("Redis 逻辑库编号无效")
		}
		db = int(number)
	}
	if connection.RedisModeValue() == model.RedisCluster && db != 0 {
		return "", errors.New("Redis 集群仅支持 DB 0")
	}
	client, closeClient := open(ctx, connection, db)
	defer closeClient()
	if err := client.Ping(ctx).Err(); err != nil {
		return "", err
	}
	info, err := client.Info(ctx, "server").Result()
	if err == nil {
		if version := fields(info)["redis_version"]; version != "" {
			return "Redis " + version, nil
		}
	}
	return "Redis · PONG", nil
}

func fields(info string) map[string]string {
	out := make(map[string]string)
	for _, line := range strings.Split(info, "\n") {
		if key, value, ok := strings.Cut(strings.TrimSpace(line), ":"); ok {
			out[key] = value
		}
	}
	return out
}
