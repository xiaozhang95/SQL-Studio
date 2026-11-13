package greptimedb

import (
	"context"
	"errors"
	"strings"

	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/mysql"
)

type Client struct {
	wire *mysql.Client
}

func NewClient() *Client {
	return &Client{wire: mysql.NewClientWithDefaultDatabase(defaultDatabase)}
}

func defaultDatabase(connection model.Connection) string {
	if database := strings.TrimSpace(connection.Database); database != "" {
		return database
	}
	return "public"
}

func (c *Client) Test(ctx context.Context, connection model.Connection) (string, error) {
	return c.wire.Test(ctx, connection)
}

func (c *Client) SetSession(ctx context.Context, connection model.Connection, database *string, open bool) error {
	return c.wire.SetSession(ctx, connection, database, open)
}

func (c *Client) Schemas(context.Context, model.Connection, string) ([]string, error) {
	return []string{}, nil
}

func (c *Client) Databases(ctx context.Context, connection model.Connection) ([]string, error) {
	return c.wire.Databases(ctx, connection)
}

func (c *Client) Tables(ctx context.Context, connection model.Connection, database string) ([]model.Table, error) {
	return c.wire.Tables(ctx, connection, database)
}

func (c *Client) Columns(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Column, error) {
	return c.wire.Columns(ctx, connection, ref)
}

func (c *Client) Indexes(ctx context.Context, connection model.Connection, ref model.TableRef) ([]model.Index, error) {
	indexes, err := c.wire.Indexes(ctx, connection, ref)
	for i := range indexes {
		indexes[i].Primary = indexes[i].Name == "PRIMARY"
	}
	return indexes, err
}

func (c *Client) DDL(ctx context.Context, connection model.Connection, ref model.TableRef) (string, error) {
	tables, err := c.Tables(ctx, connection, ref.Database)
	if err != nil {
		return "", err
	}
	for _, table := range tables {
		if table.Name != ref.Name {
			continue
		}
		if table.Type != "VIEW" {
			return c.wire.DDL(ctx, connection, ref)
		}
		result, err := c.wire.ExecuteStatement(ctx, connection, model.QueryRequest{
			Database: ref.Database, SQL: "SHOW CREATE VIEW " + quoteIdentifier(ref.Name), Limit: 1,
		}, true)
		if err != nil {
			return "", err
		}
		if len(result.Rows) == 1 && len(result.Rows[0]) >= 2 {
			if ddl, ok := result.Rows[0][1].(string); ok {
				return ddl, nil
			}
		}
		return "", errors.New("数据库返回的 DDL 结构不完整")
	}
	return "", errors.New("未找到表结构")
}

func (c *Client) Execute(ctx context.Context, connection model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	if input.Schema != "" {
		return model.QueryResult{}, errors.New("GreptimeDB 不使用独立 schema 范围")
	}
	if input.MatchRows {
		return model.QueryResult{}, errors.New("GreptimeDB 不支持匹配行计数")
	}
	returnsRows, err := classifyStatement(input.SQL, input.AllowWrite)
	if err != nil {
		return model.QueryResult{}, err
	}
	if input.Database == "" {
		input.Database = defaultDatabase(connection)
	}
	return c.wire.ExecuteStatement(ctx, connection, input, returnsRows)
}

func quoteIdentifier(value string) string {
	return "`" + strings.ReplaceAll(value, "`", "``") + "`"
}
