package chat

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

type fakeDB struct {
	targets []model.Target
	calls   int
}

func (*fakeDB) Connections(context.Context) ([]model.Connection, error) {
	return []model.Connection{{ID: "a", Name: "测试", Type: "postgresql"}, {ID: "b", Name: "备用", Type: "mysql"}}, nil
}
func (*fakeDB) Databases(context.Context, string) ([]string, error) { return []string{"demo"}, nil }
func (d *fakeDB) Execute(_ context.Context, target model.Target, _, _, _ string) (json.RawMessage, error) {
	d.calls++
	d.targets = append(d.targets, target)
	return json.RawMessage(`{"rows":[["9007199254740993"]]}`), nil
}

type generatorFunc func(context.Context, []model.Message, []model.Tool) (model.Message, error)

func (f generatorFunc) Generate(ctx context.Context, m []model.Message, t []model.Tool) (model.Message, error) {
	return f(ctx, m, t)
}
func call(name, args string) model.Message {
	return model.Message{Role: "assistant", ToolCalls: []model.ToolCall{{ID: "c", Type: "function", Function: model.Function{Name: name, Arguments: args}}}}
}
func TestPureChatDiscoveryQueryAndContinuation(t *testing.T) {
	db := &fakeDB{}
	step := 0
	script := []model.Message{call("list_connections", `{}`), call("list_databases", `{"connectionId":"a"}`), call("use_database", `{"connectionId":"a","database":"demo"}`), call("list_tables", `{}`), call("describe_table", `{"table":"orders"}`), call("query_readonly", `{"sql":"SELECT 1"}`), {Role: "assistant", Content: "完成"}}
	g := generatorFunc(func(_ context.Context, m []model.Message, tools []model.Tool) (model.Message, error) {
		if len(tools) != 6 {
			t.Fatal("missing discovery tools")
		}
		if step == 6 && !strings.Contains(m[len(m)-1].Content, "9007199254740993") {
			t.Fatal("lost result precision")
		}
		if step >= len(script) {
			return model.Message{Role: "assistant", Content: "继续"}, nil
		}
		out := script[step]
		step++
		return out, nil
	})
	s := New(g, db)
	id, err := s.Create(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if s.sessions[id].state.target.ConnectionID != "" {
		t.Fatal("session required preselection")
	}
	if err = s.Chat(context.Background(), id, "查测试连接demo库", func(model.Event) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if db.calls != 3 || db.targets[2].ConnectionID != "a" || s.sessions[id].state.target.Database != "demo" {
		t.Fatal("bad target")
	}
	if err = s.Chat(context.Background(), id, "继续", func(model.Event) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if len(s.sessions[id].messages) < 10 {
		t.Fatal("lost history")
	}
}
func TestUnboundQueryAndEscalationRejected(t *testing.T) {
	cases := []struct{ name, args string }{{"query_readonly", `{"sql":"SELECT 1"}`}, {"query_readonly", `{"sql":"DELETE FROM t","allowWrite":true}`}, {"query_readonly", `{"sql":"SELECT 1","connectionId":"b"}`}, {"describe_table", `null`}, {"list_tables", `{} {}`}, {"drop_table", `{}`}, {"use_database", `{"connectionId":"a","database":"demo"}`}, {"list_databases", `{"connectionId":"unknown"}`}}
	for _, item := range cases {
		db := &fakeDB{}
		s := New(nil, db)
		state := toolState{databases: map[string][]string{}}
		_, err := s.execute(context.Background(), &state, call(item.name, item.args).ToolCalls[0])
		if err == nil || db.calls != 0 {
			t.Fatalf("accepted %s %s", item.name, item.args)
		}
	}
}
func TestSwitchDiscoveredDatabaseAndSessionIsolation(t *testing.T) {
	db := &fakeDB{}
	s := New(nil, db)
	state := toolState{databases: map[string][]string{}}
	for _, c := range []model.Message{call("list_connections", `{}`), call("list_databases", `{"connectionId":"a"}`), call("use_database", `{"connectionId":"a","database":"demo"}`), call("list_databases", `{"connectionId":"b"}`), call("use_database", `{"connectionId":"b","database":"demo"}`), call("query_readonly", `{"sql":"SELECT 1"}`)} {
		if _, err := s.execute(context.Background(), &state, c.ToolCalls[0]); err != nil {
			t.Fatal(err)
		}
	}
	if db.targets[0].ConnectionID != "b" {
		t.Fatal("query used previous connection")
	}
	id, _ := s.Create(context.Background())
	if s.sessions[id].state.target.ConnectionID != "" || len(s.sessions[id].state.connections) != 0 {
		t.Fatal("cross-session scope leak")
	}
}
func TestAmbiguousTargetCanBeClarifiedInChat(t *testing.T) {
	db := &fakeDB{}
	step := 0
	s := New(generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
		step++
		if step == 1 {
			return call("list_connections", `{}`), nil
		}
		return model.Message{Role: "assistant", Content: "你希望查看测试连接还是备用连接？"}, nil
	}), db)
	id, _ := s.Create(context.Background())
	if err := s.Chat(context.Background(), id, "查一下订单", func(model.Event) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if db.calls != 0 || s.sessions[id].state.target.ConnectionID != "" {
		t.Fatal("clarification executed a query")
	}
}
func TestBudgetAndFailureDoNotCommitDiscovery(t *testing.T) {
	db := &fakeDB{}
	s := New(generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
		return call("list_connections", `{}`), nil
	}), db)
	id, _ := s.Create(context.Background())
	if err := s.Chat(context.Background(), id, "一直查", func(model.Event) error { return nil }); err == nil {
		t.Fatal("unbounded loop")
	}
	if len(s.sessions[id].messages) != 1 || len(s.sessions[id].state.connections) != 0 {
		t.Fatal("failed state committed")
	}
}
func TestCancellationPropagates(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	db := &fakeDB{}
	s := New(generatorFunc(func(ctx context.Context, _ []model.Message, _ []model.Tool) (model.Message, error) {
		cancel()
		return model.Message{}, ctx.Err()
	}), db)
	id, _ := s.Create(ctx)
	err := s.Chat(ctx, id, "停止", func(model.Event) error { return nil })
	if !errors.Is(err, context.Canceled) || db.calls != 0 || s.sessions[id].busy {
		t.Fatal("cancellation failed")
	}
}
