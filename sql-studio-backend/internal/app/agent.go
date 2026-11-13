package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
	agent "sql-studio-backend/internal/modules/agent"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/statefile"
	"strings"
)

type agentDatabase struct {
	connections *connections.Service
	metadata    *metadata.Service
	queries     *query.Service
}

func (d agentDatabase) Connections(ctx context.Context) ([]agentmodel.Connection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	out := []agentmodel.Connection{}
	for _, c := range d.connections.ListConnections() {
		if c.Type == model.TypeGreptimeDB {
			continue
		}
		out = append(out, agentmodel.Connection{ID: c.ID, Name: c.Name, Type: c.Type})
	}
	if data, err := json.Marshal(out); err != nil || len(data) > 256*1024 {
		return nil, errors.New("连接列表超过256 KiB，请缩小范围")
	}
	return out, nil
}
func (d agentDatabase) Databases(ctx context.Context, id string) ([]string, error) {
	names, err := d.metadata.Databases(ctx, id)
	if err != nil {
		return nil, agentReadError(err)
	}
	if data, err := json.Marshal(names); err != nil || len(data) > 256*1024 {
		return nil, errors.New("数据库列表超过256 KiB，请缩小范围")
	}
	return names, nil
}
func (d agentDatabase) Execute(ctx context.Context, target agentmodel.Target, name, table, sql string) (json.RawMessage, error) {
	var value interface{}
	var err error
	switch name {
	case "list_tables":
		value, err = d.metadata.Tables(ctx, target.ConnectionID, target.Database)
	case "describe_table":
		if strings.TrimSpace(table) == "" {
			return nil, errors.New("table不能为空")
		}
		value, err = d.metadata.Columns(ctx, target.ConnectionID, target.Database, table)
	case "query_readonly":
		if strings.TrimSpace(sql) == "" || len(sql) > 16000 {
			return nil, errors.New("SQL为空或过长")
		}
		engine, scopeErr := d.agentTargetEngine(target.ConnectionID)
		if scopeErr != nil {
			return nil, scopeErr
		}
		if err := agent.ValidateReadSQL(sql, engine, target.Database); err != nil {
			return nil, err
		}
		value, err = d.queries.Query(ctx, target.ConnectionID, model.QueryRequest{Database: target.Database, SQL: sql, Limit: 100, AllowWrite: false})
	default:
		return nil, errors.New("不支持的工具")
	}
	if err != nil {
		return nil, agentReadError(err)
	}
	data, err := json.Marshal(value)
	if err == nil && len(data) > agentmodel.ToolMaxBytes {
		return nil, agentmodel.ErrToolResultTooLarge
	}
	return data, err
}

// Match the former HTTP boundary: driver connection details never enter model context.
func agentDatabaseError(err error) error {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, query.ErrBusy) {
		return err
	}
	return errors.New("数据库操作失败，请检查连接状态、SQL、对象及数据库权限")
}

func agentReadError(err error) error {
	return fmt.Errorf("%w：%w", agentmodel.ErrReadOperation, agentDatabaseError(err))
}

type agentCredentials struct{ store *statefile.Store }

func (c agentCredentials) Credentials(ctx context.Context) (agentmodel.AICredentials, error) {
	doc, err := c.store.Read(ctx, model.AIModelsSection)
	if err != nil {
		return agentmodel.AICredentials{}, err
	}
	var cfg model.AIConfig
	if doc.Revision > 0 && json.Unmarshal(doc.Data, &cfg) != nil {
		return agentmodel.AICredentials{}, errors.New("AI配置损坏")
	}
	selected, ok := cfg.SelectedConfiguration()
	if !ok {
		return agentmodel.AICredentials{}, errors.New("请先添加模型并在使用处选择")
	}
	return agentmodel.AICredentials{APIKey: selected.APIKey, Model: selected.Model}, nil
}

func (d agentDatabase) Write(ctx context.Context, target agentmodel.Target, sql string) (json.RawMessage, error) {
	if err := agent.ValidateWriteSQL(sql); err != nil {
		return nil, err
	}
	engine, err := d.agentTargetEngine(target.ConnectionID)
	if err != nil {
		return nil, err
	}
	if err := agent.ValidateSQLScope(sql, engine, target.Database); err != nil {
		return nil, err
	}
	value, err := d.queries.Query(ctx, target.ConnectionID, model.QueryRequest{Database: target.Database, SQL: sql, Limit: 100, AllowWrite: true})
	if err != nil {
		return nil, agentDatabaseError(err)
	}
	data, err := json.Marshal(value)
	if err == nil && len(data) > agentmodel.ToolMaxBytes {
		return json.RawMessage(`{"warning":"数据库写入已执行，返回结果超过 256 KiB，请另行查询所需字段。"}`), nil
	}
	return data, err
}

// Re-read the current engine: a discovered connection may have been edited
// while the model was generating or waiting for a write confirmation.
func (d agentDatabase) agentTargetEngine(id string) (string, error) {
	if d.connections == nil { // Minimal executor fixtures omit connection discovery.
		return "", nil
	}
	for _, c := range d.connections.ListConnections() {
		if c.ID == id && c.Type != model.TypeGreptimeDB {
			return c.Type, nil
		}
	}
	return "", errors.New("连接已不存在，请重新发现目标")
}
