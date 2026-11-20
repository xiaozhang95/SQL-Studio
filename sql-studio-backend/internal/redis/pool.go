package redis

import (
	"context"
	"slices"
	"time"

	driver "github.com/redis/go-redis/v9"
	"sql-studio-backend/internal/model"
)

const (
	maxRedisPools = 32
	redisPoolSize = 16
	redisPoolIdle = 2 * time.Minute
)

type pooledClient struct {
	connection model.Connection
	client     driver.UniversalClient
	users      int
	idleSince  time.Time
	idleTimer  *time.Timer
}

// acquirePool uses a caller's request lease to check the session again under
// the cache lock. Cancelling one operation never closes a shared pool.
func (c *Client) acquirePool(ctx context.Context, connection model.Connection, db int) (driver.UniversalClient, func(), error) {
	scope := redisScope{connection.ID, db}
	c.mu.Lock()
	if err := ctx.Err(); err != nil {
		c.mu.Unlock()
		return nil, nil, err
	}
	if c.scopeClosed(scope) {
		c.mu.Unlock()
		return nil, nil, errRedisScopeClosed
	}

	entry := c.pools[scope]
	var retired *pooledClient
	if entry == nil || !sameRedisSettings(entry.connection, connection) {
		if entry != nil {
			retired = c.removePool(scope)
		} else if len(c.pools) >= maxRedisPools {
			evictedScope, idle := c.oldestIdlePool()
			if idle == nil {
				c.mu.Unlock()
				client, release := open(ctx, connection, db)
				return client, release, nil
			}
			retired = c.removePool(evictedScope)
		}
		connection.RedisNodes = slices.Clone(connection.RedisNodes)
		entry = &pooledClient{connection: connection, client: newRedisClient(connection, db, redisPoolSize)}
		c.pools[scope] = entry
	}
	if entry.idleTimer != nil {
		entry.idleTimer.Stop()
		entry.idleTimer = nil
	}
	entry.users++
	c.mu.Unlock()
	if retired != nil {
		_ = retired.client.Close()
	}
	return entry.client, func() {
		c.mu.Lock()
		entry.users--
		if entry.users == 0 && c.pools[scope] == entry {
			idleSince := time.Now()
			entry.idleSince = idleSince
			entry.idleTimer = time.AfterFunc(redisPoolIdle, func() {
				c.mu.Lock()
				if c.pools[scope] != entry || entry.users != 0 || entry.idleSince != idleSince {
					c.mu.Unlock()
					return
				}
				c.removePool(scope)
				c.mu.Unlock()
				_ = entry.client.Close()
			})
		}
		c.mu.Unlock()
	}, nil
}

// removePool removes a known entry while holding c.mu. The caller closes it
// after unlocking.
func (c *Client) removePool(scope redisScope) *pooledClient {
	entry := c.pools[scope]
	delete(c.pools, scope)
	if entry.idleTimer != nil {
		entry.idleTimer.Stop()
		entry.idleTimer = nil
	}
	return entry
}

// oldestIdlePool must be called while holding c.mu.
func (c *Client) oldestIdlePool() (redisScope, *pooledClient) {
	var scope redisScope
	var oldest *pooledClient
	for key, entry := range c.pools {
		if entry.users == 0 && (oldest == nil || entry.idleSince.Before(oldest.idleSince)) {
			scope, oldest = key, entry
		}
	}
	return scope, oldest
}

func sameRedisSettings(a, b model.Connection) bool {
	return a.Host == b.Host && a.Port == b.Port && a.TLS == b.TLS &&
		a.Username == b.Username && a.Password == b.Password &&
		a.RedisModeValue() == b.RedisModeValue() && slices.Equal(a.RedisNodes, b.RedisNodes) &&
		a.RedisMasterName == b.RedisMasterName &&
		a.RedisSentinelUsername == b.RedisSentinelUsername && a.RedisSentinelPassword == b.RedisSentinelPassword
}
