// Package database dispatches engine-neutral ports to concrete implementations supplied by app.
package database

import (
	"context"
	"errors"
	"time"

	"sql-studio-backend/internal/model"
)

type Engine interface {
	Schemas(context.Context, model.Connection, string) ([]string, error)
	Test(context.Context, model.Connection) (string, error)
	SetSession(context.Context, model.Connection, *string, bool) error
	Databases(context.Context, model.Connection) ([]string, error)
	Tables(context.Context, model.Connection, string) ([]model.Table, error)
	Columns(context.Context, model.Connection, model.TableRef) ([]model.Column, error)
	Indexes(context.Context, model.Connection, model.TableRef) ([]model.Index, error)
	DDL(context.Context, model.Connection, model.TableRef) (string, error)
	Execute(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}
type Client struct{ engines map[string]Engine }

func New(engines map[string]Engine) *Client {
	copy := make(map[string]Engine, len(engines))
	for key, value := range engines {
		copy[key] = value
	}
	return &Client{engines: copy}
}
func (c *Client) engine(connection model.Connection) (Engine, error) {
	engine := c.engines[model.NormalizeDatabaseType(connection.Type)]
	if engine == nil {
		return nil, errors.New("不支持的数据库类型")
	}
	return engine, nil
}
func (c *Client) Test(ctx context.Context, v model.Connection) (string, error) {
	e, err := c.engine(v)
	if err != nil {
		return "", err
	}
	return e.Test(ctx, v)
}
func (c *Client) SetSession(ctx context.Context, v model.Connection, db *string, open bool) error {
	e, err := c.engine(v)
	if err != nil {
		return err
	}
	return e.SetSession(ctx, v, db, open)
}
func (c *Client) Databases(ctx context.Context, v model.Connection) ([]string, error) {
	e, err := c.engine(v)
	if err != nil {
		return nil, err
	}
	return e.Databases(ctx, v)
}
func (c *Client) Tables(ctx context.Context, v model.Connection, db string) ([]model.Table, error) {
	e, err := c.engine(v)
	if err != nil {
		return nil, err
	}
	return e.Tables(ctx, v, db)
}
func (c *Client) Columns(ctx context.Context, v model.Connection, ref model.TableRef) ([]model.Column, error) {
	e, err := c.engine(v)
	if err != nil {
		return nil, err
	}
	return e.Columns(ctx, v, ref)
}
func (c *Client) Indexes(ctx context.Context, v model.Connection, ref model.TableRef) ([]model.Index, error) {
	e, err := c.engine(v)
	if err != nil {
		return nil, err
	}
	return e.Indexes(ctx, v, ref)
}
func (c *Client) DDL(ctx context.Context, v model.Connection, ref model.TableRef) (string, error) {
	e, err := c.engine(v)
	if err != nil {
		return "", err
	}
	return e.DDL(ctx, v, ref)
}
func (c *Client) Execute(ctx context.Context, v model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	e, err := c.engine(v)
	if err != nil {
		return model.QueryResult{}, err
	}
	return e.Execute(ctx, v, input)
}

func (c *Client) ExecuteBatch(ctx context.Context, connection model.Connection, input model.QueryBatchRequest, statementTimeout time.Duration, emit func(model.QueryBatchStep) error) error {
	if kind := model.NormalizeDatabaseType(connection.Type); kind != model.TypeMySQL && kind != model.TypeMariaDB {
		return errors.New("该引擎不支持同一会话批量执行")
	}
	engine, err := c.engine(connection)
	if err != nil {
		return err
	}
	executor, ok := engine.(interface {
		ExecuteBatch(context.Context, model.Connection, model.QueryBatchRequest, time.Duration, func(model.QueryBatchStep) error) error
	})
	if !ok {
		return errors.New("该引擎不支持同一会话批量执行")
	}
	return executor.ExecuteBatch(ctx, connection, input, statementTimeout, emit)
}

func (c *Client) Schemas(ctx context.Context, connection model.Connection, database string) ([]string, error) {
	engine, err := c.engine(connection)
	if err != nil {
		return nil, err
	}
	return engine.Schemas(ctx, connection, database)
}

// StreamTableData dispatches only to an explicitly supported streaming engine.
func (c *Client) StreamTableData(ctx context.Context, connection model.Connection, ref model.TableRef, emit func(model.QueryResult) error) error {
	engine, err := c.engine(connection)
	if err != nil {
		return err
	}
	exporter, ok := engine.(interface {
		StreamTableData(context.Context, model.Connection, model.TableRef, func(model.QueryResult) error) error
	})
	if !ok {
		return errors.New("该引擎不支持流式导出")
	}
	return exporter.StreamTableData(ctx, connection, ref, emit)
}
