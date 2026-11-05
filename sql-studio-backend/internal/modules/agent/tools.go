package chat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sql-studio-backend/internal/model/agent"
	"strings"
)

func (s *Service) execute(ctx context.Context, state *toolState, call model.ToolCall, emitters ...func(model.Event) error) (json.RawMessage, error) {
	switch call.Function.Name {
	case "list_connections":
		if err := decode(call.Function.Arguments, &struct{}{}); err != nil {
			return nil, err
		}
		items, err := s.db.Connections(ctx)
		if err != nil {
			return nil, err
		}
		state.connections = items
		return json.Marshal(items)
	case "list_databases":
		var args struct {
			ConnectionID string `json:"connectionId"`
		}
		if err := decode(call.Function.Arguments, &args); err != nil {
			return nil, err
		}
		connection, ok := findConnection(state.connections, args.ConnectionID)
		if !ok {
			return nil, errors.New("请先列出连接并使用其中真实的connectionId")
		}
		if warning, skipped := state.unavailableDatabases[args.ConnectionID]; skipped {
			return warning, nil
		}
		names, err := s.db.Databases(ctx, args.ConnectionID)
		if err != nil {
			if ctx.Err() != nil || !errors.Is(err, model.ErrReadOperation) {
				return nil, err
			}
			warning, err := json.Marshal(map[string]string{
				"connectionId": args.ConnectionID,
				"warning":      fmt.Sprintf("连接 %q 的数据库列表读取失败，本轮已跳过。", connection.Name),
				"instruction":  "根据已成功读取的结果继续。若此连接是用户指定的目标，或无法确认目标，请说明哪些连接未能检查，并向用户确认后续范围。不要将未能读取当作数据库不存在。",
			})
			if err != nil {
				return nil, err
			}
			delete(state.databases, args.ConnectionID)
			if state.unavailableDatabases == nil {
				state.unavailableDatabases = make(map[string]json.RawMessage)
			}
			state.unavailableDatabases[args.ConnectionID] = warning
			return warning, nil
		}
		state.databases[args.ConnectionID] = names
		return json.Marshal(names)
	case "use_database":
		var args model.Target
		if err := decode(call.Function.Arguments, &args); err != nil {
			return nil, err
		}
		connection, ok := findConnection(state.connections, args.ConnectionID)
		if !ok {
			return nil, errors.New("连接未经发现，请先列出连接")
		}
		found := false
		for _, name := range state.databases[args.ConnectionID] {
			if name == args.Database {
				found = true
			}
		}
		if !found {
			return nil, errors.New("数据库未经发现或不存在，请先列出该连接的数据库")
		}
		if connection.Type != "mysql" && connection.Type != "mariadb" && connection.Type != "postgresql" && connection.Type != "" {
			return nil, errors.New("该连接引擎尚不支持")
		}
		// Revalidate a discovered target; discovery history is not proof that it still exists.
		current, err := s.db.Connections(ctx)
		if err != nil {
			return nil, err
		}
		connection, ok = findConnection(current, args.ConnectionID)
		if !ok {
			return nil, errors.New("连接已不存在")
		}
		if connection.Type == "" {
			connection.Type = "mysql"
		}
		if connection.Type != "mysql" && connection.Type != "mariadb" && connection.Type != "postgresql" {
			return nil, errors.New("该连接引擎尚不支持")
		}
		names, err := s.db.Databases(ctx, args.ConnectionID)
		if err != nil {
			return nil, err
		}
		found = false
		for _, name := range names {
			if name == args.Database {
				found = true
			}
		}
		if !found {
			return nil, errors.New("数据库已不存在或不可访问")
		}
		state.target = args
		return json.Marshal(struct {
			Target model.Target `json:"target"`
			Engine string       `json:"engine"`
		}{args, connection.Type})
	case "list_tables":
		if err := decode(call.Function.Arguments, &struct{}{}); err != nil {
			return nil, err
		}
		return s.run(ctx, state.target, call.Function.Name, "", "")
	case "describe_table":
		var args struct {
			Table string `json:"table"`
		}
		if err := decode(call.Function.Arguments, &args); err != nil {
			return nil, err
		}
		return s.run(ctx, state.target, call.Function.Name, args.Table, "")
	case "execute_write":
		if !state.allowWrite {
			return nil, errors.New("当前只读模式不允许新增或修改")
		}
		var args struct {
			SQL string `json:"sql"`
		}
		if err := decode(call.Function.Arguments, &args); err != nil {
			return nil, err
		}
		if err := ValidateWriteSQL(args.SQL); err != nil {
			return nil, err
		}
		if state.target.ConnectionID == "" || state.target.Database == "" {
			return nil, errors.New("请先确定数据库")
		}
		connection, _ := findConnection(state.connections, state.target.ConnectionID)
		if err := ValidateSQLScope(args.SQL, connection.Type, state.target.Database); err != nil {
			return nil, err
		}
		writer, ok := s.db.(WriteDatabase)
		if !ok {
			return nil, errors.New("写入能力未装配")
		}
		var emit func(model.Event) error
		if len(emitters) > 0 {
			emit = emitters[0]
		}
		if err := s.approveWrite(ctx, state, args.SQL, emit); err != nil {
			return nil, writeApprovalError{err}
		}
		return writer.Write(ctx, state.target, args.SQL)
	case "query_readonly":
		var args struct {
			SQL string `json:"sql"`
		}
		if err := decode(call.Function.Arguments, &args); err != nil {
			return nil, err
		}
		connection, _ := findConnection(state.connections, state.target.ConnectionID)
		if err := ValidateReadSQL(args.SQL, connection.Type, state.target.Database); err != nil {
			return nil, err
		}
		return s.run(ctx, state.target, call.Function.Name, "", args.SQL)
	default:
		return nil, errors.New("不支持的工具")
	}
}
func (s *Service) run(ctx context.Context, target model.Target, name, table, sql string) (json.RawMessage, error) {
	if target.ConnectionID == "" || target.Database == "" {
		return nil, errors.New("尚未确定数据库。先发现连接与数据库；目标不明确时通过聊天追问，再调用use_database")
	}
	return s.db.Execute(ctx, target, name, table, sql)
}
func findConnection(items []model.Connection, id string) (model.Connection, bool) {
	for _, item := range items {
		if item.ID == id && id != "" {
			return item, true
		}
	}
	return model.Connection{}, false
}

func validateRecoveryTarget(current model.Target, call model.ToolCall) error {
	if current.ConnectionID == "" {
		return nil
	}
	switch call.Function.Name {
	case "use_database":
		var target model.Target
		if decode(call.Function.Arguments, &target) != nil || target != current {
			return errors.New("恢复期间仅允许使用已确认的数据库")
		}
	case "list_databases":
		var target struct {
			ConnectionID string `json:"connectionId"`
		}
		if decode(call.Function.Arguments, &target) != nil || target.ConnectionID != current.ConnectionID {
			return errors.New("恢复期间仅允许探测已确认的连接")
		}
	}
	return nil
}
func decode(input string, out interface{}) error {
	if len(input) > 20000 || !strings.HasPrefix(strings.TrimSpace(input), "{") {
		return errors.New("工具参数必须是JSON对象")
	}
	d := json.NewDecoder(bytes.NewBufferString(input))
	d.DisallowUnknownFields()
	if d.Decode(out) != nil {
		return errors.New("工具参数无效或含未授权字段")
	}
	if d.Decode(new(json.RawMessage)) != io.EOF {
		return errors.New("工具参数只能包含一个对象")
	}
	return nil
}
func tools() []model.Tool {
	return []model.Tool{
		{Type: "function", Function: model.ToolDefinition{Name: "list_connections", Description: "发现已保存的数据库连接，仅返回id/name/type；多目标不明确时通过聊天追问", Parameters: json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`)}},
		{Type: "function", Function: model.ToolDefinition{Name: "list_databases", Description: "列出已发现连接的可访问数据库", Parameters: json.RawMessage(`{"type":"object","properties":{"connectionId":{"type":"string"}},"required":["connectionId"],"additionalProperties":false}`)}},
		{Type: "function", Function: model.ToolDefinition{Name: "use_database", Description: "根据聊天意图设置已发现的连接和数据库。只有唯一匹配或用户已说明目标时使用；多目标歧义先用聊天询问", Parameters: json.RawMessage(`{"type":"object","properties":{"connectionId":{"type":"string"},"database":{"type":"string"}},"required":["connectionId","database"],"additionalProperties":false}`)}},
		{Type: "function", Function: model.ToolDefinition{Name: "list_tables", Description: "列出当前数据库的真实表和视图，必须先use_database", Parameters: json.RawMessage(`{"type":"object","properties":{},"additionalProperties":false}`)}},
		{Type: "function", Function: model.ToolDefinition{Name: "describe_table", Description: "读取表字段与备注，table原样使用list_tables返回的name", Parameters: json.RawMessage(`{"type":"object","properties":{"table":{"type":"string"}},"required":["table"],"additionalProperties":false}`)}},
		{Type: "function", Function: model.ToolDefinition{Name: "query_readonly", Description: "在当前数据库执行单条只读SQL，最多100行；不接受目标或写入参数，禁止跨库及副作用函数", Parameters: json.RawMessage(`{"type":"object","properties":{"sql":{"type":"string"}},"required":["sql"],"additionalProperties":false}`)}},
	}
}
