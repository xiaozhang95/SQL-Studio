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
}

func NewClient() *Client {
	return &Client{control: make(chan struct{}, 1), closed: make(map[redisScope]bool), active: make(map[*requestLease]struct{})}
}

func open(ctx context.Context, connection model.Connection, db int) (*driver.Client, func()) {
	host := strings.TrimPrefix(strings.TrimSuffix(strings.TrimSpace(connection.Host), "]"), "[")
	options := &driver.Options{
		Addr:     net.JoinHostPort(host, strconv.Itoa(connection.Port)),
		Username: connection.Username, Password: connection.Password, DB: db,
		Protocol: 2, DisableIdentity: true, ContextTimeoutEnabled: true,
		MaxRetries: -1, DialerRetries: 1, PoolSize: 1,
		DialTimeout: 4 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second,
	}
	if connection.Username != "" && connection.Password == "" {
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
		options.TLSConfig = &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	}
	client := driver.NewClient(options)
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

func (*Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	db := 0
	if connection.Database != "" {
		number, err := strconv.ParseUint(connection.Database, 10, 31)
		if err != nil {
			return "", errors.New("Redis 逻辑库编号无效")
		}
		db = int(number)
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

func (c *Client) Monitor(ctx context.Context, connection model.Connection, _ string) (model.MonitorSnapshot, error) {
	ctx, release, err := c.beginRequest(ctx, connection.ID, instanceScope)
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	defer release()
	client, closeClient := open(ctx, connection, 0)
	defer closeClient()
	info, err := client.Info(ctx).Result()
	if err != nil {
		return model.MonitorSnapshot{}, err
	}
	values := fields(info)
	order := []struct{ source, key string }{
		{"connected_clients", "connections"},
		{"instantaneous_ops_per_sec", "redis_ops"},
		{"used_memory", "redis_memory_bytes"},
		{"uptime_in_seconds", "uptime"},
		{"total_commands_processed", "redis_commands"},
		{"expired_keys", "redis_expired"},
		{"evicted_keys", "redis_evicted"},
	}
	var metrics []model.MonitorMetric
	for _, item := range order {
		if value := values[item.source]; value != "" {
			metrics = append(metrics, model.MonitorMetric{Key: item.key, Value: value})
		}
	}
	hits, hitErr := strconv.ParseFloat(values["keyspace_hits"], 64)
	misses, missErr := strconv.ParseFloat(values["keyspace_misses"], 64)
	if hitErr == nil && missErr == nil && hits+misses > 0 {
		metrics = append(metrics, model.MonitorMetric{Key: "cache_hit_percent", Value: strconv.FormatFloat(100*hits/(hits+misses), 'f', 1, 64)})
	}
	return model.MonitorSnapshot{Database: "", SampledAt: time.Now().UTC(), Metrics: metrics}, nil
}
