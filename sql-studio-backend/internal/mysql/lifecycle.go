package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sync"

	"sql-studio-backend/internal/model"
)

type requestLease struct {
	id, database string
	cancel       context.CancelFunc
	done         chan struct{}
	err          error
}

func sessionKey(id string, database *string) string {
	value, _ := json.Marshal([]any{id, database})
	return string(value)
}

func (c *Client) openRequest(ctx context.Context, connection model.Connection, database string) (context.Context, *sql.DB, func(), error) {
	return c.openScopedRequest(ctx, connection, database, false)
}

func (c *Client) openScopedRequest(ctx context.Context, connection model.Connection, database string, probe bool) (context.Context, *sql.DB, func(), error) {
	ctx, db, _, release, err := c.openLeasedRequest(ctx, connection, database, probe)
	return ctx, db, release, err
}

func (c *Client) openLeasedRequest(ctx context.Context, connection model.Connection, database string, probe bool) (context.Context, *sql.DB, *requestLease, func(), error) {
	c.mu.Lock()
	parent, target := sessionKey(connection.ID, nil), sessionKey(connection.ID, &database)
	// 显式“测试连接”可临时探测已关闭配置，但不能在关闭进行中偷偷重建连接。
	if c.closing[parent] || c.closing[target] || (!probe && (c.closed[parent] || c.closed[target])) {
		c.mu.Unlock()
		return ctx, nil, nil, nil, errors.New("连接或数据库已关闭，请重新打开")
	}
	requestCtx, cancel := context.WithCancel(ctx)
	lease := &requestLease{id: connection.ID, database: database, cancel: cancel, done: make(chan struct{})}
	c.active[lease] = true
	c.mu.Unlock()
	open := c.open
	if matched, _ := ctx.Value(matchRowsKey{}).(bool); matched {
		open = c.openMatched
	}
	db, err := open(connection, database)
	var once sync.Once
	release := func() {
		once.Do(func() {
			cancel()
			var closeErr error
			if db != nil {
				closeErr = db.Close()
			}
			c.mu.Lock()
			lease.err = closeErr
			delete(c.active, lease)
			close(lease.done)
			c.mu.Unlock()
		})
	}
	if err != nil {
		release()
		return ctx, nil, nil, nil, err
	}
	return requestCtx, db, lease, release, nil
}

// SetSession 关闭本客户端拥有的连接，等待驱动资源释放；不会终止其他客户端的 MySQL 会话。
func (c *Client) SetSession(ctx context.Context, connection model.Connection, database *string, open bool) error {
	select {
	case c.control <- struct{}{}:
		defer func() { <-c.control }()
	case <-ctx.Done():
		return ctx.Err()
	}
	key := sessionKey(connection.ID, database)
	if open {
		c.mu.Lock()
		for lease := range c.active {
			if c.closed[key] && lease.id == connection.ID && (database == nil || lease.database == *database) {
				c.mu.Unlock()
				return errors.New("连接仍在关闭，请稍后重试")
			}
		}
		parentClosed := database != nil && c.closed[sessionKey(connection.ID, nil)]
		c.mu.Unlock()
		if parentClosed {
			return errors.New("请先打开连接")
		}
		schema := ""
		if database != nil {
			schema = *database
		}
		db, err := c.open(connection, schema)
		if err != nil {
			return err
		}
		err = db.PingContext(ctx)
		closeErr := db.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		c.mu.Lock()
		delete(c.closed, key)
		c.mu.Unlock()
		return nil
	}
	c.mu.Lock()
	c.closed[key] = true
	c.closing[key] = true
	leases := []*requestLease{}
	for lease := range c.active {
		if lease.id == connection.ID && (database == nil || lease.database == *database) {
			leases = append(leases, lease)
			lease.cancel()
		}
	}
	c.mu.Unlock()
	defer func() { c.mu.Lock(); delete(c.closing, key); c.mu.Unlock() }()
	// release 先关闭 sql.DB，再通知 done。超时返回失败，不能提前宣称已断开。
	for _, lease := range leases {
		select {
		case <-lease.done:
			if lease.err != nil {
				return lease.err
			}
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}
