package redis

import (
	"context"
	"errors"
	"strconv"

	"sql-studio-backend/internal/model"
)

// Instance requests cover metadata, monitoring and Pub/Sub. They are independent
// of logical databases and only stop when the parent connection closes.
const instanceScope = -1

type redisScope struct {
	id string
	db int
}

func (scope redisScope) contains(other redisScope) bool {
	return scope.id == other.id && (scope.db == instanceScope || scope.db == other.db)
}

type requestLease struct {
	scope  redisScope
	cancel context.CancelFunc
	done   chan struct{}
}

func (c *Client) beginRequest(ctx context.Context, id string, db int) (context.Context, func(), error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return ctx, nil, err
	}
	scope := redisScope{id, db}
	if c.scopeClosed(scope) {
		return ctx, nil, errRedisScopeClosed
	}
	requestCtx, cancel := context.WithCancel(ctx)
	lease := &requestLease{scope: scope, cancel: cancel, done: make(chan struct{})}
	c.active[lease] = struct{}{}
	return requestCtx, func() {
		cancel()
		c.mu.Lock()
		delete(c.active, lease)
		close(lease.done)
		c.mu.Unlock()
	}, nil
}

var errRedisScopeClosed = errors.New("连接或数据库已关闭，请重新打开")

// scopeClosed must be called while holding c.mu.
func (c *Client) scopeClosed(scope redisScope) bool {
	return c.closed[redisScope{scope.id, instanceScope}] || c.closed[scope]
}

// SetSession serializes open and close, so a close stops only this client's
// matching operations and a reopen cannot renew a session still being closed.
func (c *Client) SetSession(ctx context.Context, connection model.Connection, database *string, open bool) error {
	scope := redisScope{connection.ID, instanceScope}
	if database != nil {
		db, err := strconv.ParseUint(*database, 10, 31)
		if err != nil {
			return errors.New("Redis 逻辑库编号无效")
		}
		if connection.RedisModeValue() == model.RedisCluster && db != 0 {
			return errors.New("Redis 集群仅支持 DB 0")
		}
		scope.db = int(db)
		connection.Database = strconv.Itoa(scope.db)
	}
	select {
	case c.control <- struct{}{}:
		defer func() { <-c.control }()
	case <-ctx.Done():
		return ctx.Err()
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	c.mu.Lock()
	if open {
		if database != nil && c.closed[redisScope{connection.ID, instanceScope}] {
			c.mu.Unlock()
			return errors.New("请先打开连接")
		}
		if c.closed[scope] {
			for lease := range c.active {
				if scope.contains(lease.scope) {
					c.mu.Unlock()
					return errors.New("连接仍在关闭，请稍后重试")
				}
			}
		}
		c.mu.Unlock()
		if _, err := c.Test(ctx, connection); err != nil {
			return err
		}
		c.mu.Lock()
		delete(c.closed, scope)
		c.mu.Unlock()
		return nil
	}

	c.closed[scope] = true
	var leases []*requestLease
	for lease := range c.active {
		if scope.contains(lease.scope) {
			lease.cancel()
			leases = append(leases, lease)
		}
	}
	var pools []*pooledClient
	for key := range c.pools {
		if scope.contains(key) {
			pools = append(pools, c.removePool(key))
		}
	}
	c.mu.Unlock()
	for _, entry := range pools {
		_ = entry.client.Close()
	}
	for _, lease := range leases {
		select {
		case <-lease.done:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}
