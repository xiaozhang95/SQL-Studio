package mariadb

import (
	"context"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/mysql"
)

// Client 为 MariaDB 单独拥有连接/数据库关闭状态，不与 MySQL 实例共享可变状态。
// 连接类型保持 mariadb，底层驱动显式支持该协议身份。
type Client struct{ *mysql.Client }

func NewClient() *Client { return &Client{Client: mysql.NewClient()} }

// 专属 SEQUENCE 不冒充普通表参与浏览和转储。
func (c *Client) Tables(ctx context.Context, connection model.Connection, database string) ([]model.Table, error) {
	tables, err := c.Client.Tables(ctx, connection, database)
	if err != nil {
		return nil, err
	}
	out := make([]model.Table, 0, len(tables))
	for _, table := range tables {
		if table.Type != "SEQUENCE" {
			out = append(out, table)
		}
	}
	return out, nil
}
