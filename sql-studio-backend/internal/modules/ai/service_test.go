package ai

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
)

type repository struct{ data string }

func TestMissingModelDoesNotReachGenerator(t *testing.T) {
	g := &generator{content: `{"completion":" 1"}`}
	s := New(repository{data: `{"activeId":"","configurations":[{"id":"a","provider":"deepseek","model":"","modelName":"","apiKey":"fixture-key"}]}`}, &connections{}, g)
	if _, err := s.Assist(context.Background(), model.AIRequest{Action: "complete", Prefix: "SELECT"}); err == nil || g.calls != 0 {
		t.Fatal("missing model used a default")
	}
}

func TestModelDiscoveryUsesSpecifiedRecordKey(t *testing.T) {
	g := &generator{}
	s := New(repository{data: `{"configurations":[{"id":"a","provider":"deepseek","model":"model-a","apiKey":"fixture-key-a","modelName":"model-a"},{"id":"b","provider":"deepseek","model":"model-b","apiKey":"fixture-key-b","modelName":"model-b"}]}`}, &connections{}, g)
	if _, err := s.Models(context.Background(), model.AIModelsRequest{Provider: "deepseek", ConfigID: "b"}); err != nil || g.key != "fixture-key-b" {
		t.Fatal("wrong record key", err)
	}
	if _, err := s.Models(context.Background(), model.AIModelsRequest{Provider: "deepseek", ConfigID: "missing"}); err == nil {
		t.Fatal("unknown record fell back to another key")
	}
}

func (r repository) Read(context.Context, string) (model.StateDocument, error) {
	if r.data != "" {
		return model.StateDocument{Data: json.RawMessage(r.data)}, nil
	}
	return model.StateDocument{Data: json.RawMessage(`{"activeId":"a","configurations":[{"id":"a","provider":"deepseek","model":"deepseek-flash","modelName":"deepseek-flash","apiKey":"test-secret"}]}`)}, nil
}

type connections struct{ id string }

func (c *connections) Get(id string) (model.Connection, error) {
	c.id = id
	return model.Connection{}, nil
}

type generator struct {
	model    string
	key      string
	content  string
	calls    int
	wait     bool
	messages []model.AIMessage
}

func (g *generator) Generate(ctx context.Context, key string, modelID string, messages []model.AIMessage, tokens int) (string, error) {
	g.calls++
	g.model = modelID
	g.key = key
	g.messages = messages
	if g.wait {
		<-ctx.Done()
		return "", ctx.Err()
	}
	return g.content, nil
}
func TestScopeAndValidation(t *testing.T) {
	c := &connections{}
	g := &generator{content: `{"completion":" 1"}`}
	s := New(repository{data: `{"activeId":"","configurations":[{"id":"a","provider":"deepseek","model":"model-a","apiKey":"fixture-key-a"},{"id":"b","provider":"deepseek","model":"model-b","apiKey":"fixture-key-b"}]}`}, c, g)
	result, err := s.Assist(context.Background(), model.AIRequest{Action: "complete", ConnectionID: "beta", Prefix: "SELECT"})
	if err != nil || result.Completion != " 1" || c.id != "beta" || g.model != "model-a" || g.key != "fixture-key-a" {
		t.Fatal(result, err, c.id)
	}
	if _, err = s.Assist(context.Background(), model.AIRequest{Action: "invalid"}); err == nil || g.calls != 1 {
		t.Fatal("invalid request reached model")
	}
	g.content = `{"sql":"SELECT 1","explanation":"说明"}`
	result, err = s.Assist(context.Background(), model.AIRequest{Action: "optimize", SQL: "SELECT 1"})
	if err != nil || result.SQL != "SELECT 1" {
		t.Fatal(result, err)
	}
	g.content = "broken"
	if _, err = s.Assist(context.Background(), model.AIRequest{Action: "optimize", SQL: "SELECT 1"}); err == nil {
		t.Fatal("invalid response accepted")
	}
}
func TestCancellationAndBudget(t *testing.T) {
	g := &generator{wait: true}
	s := New(repository{}, &connections{}, g)
	for i := 0; i < cap(s.budget); i++ {
		s.budget <- struct{}{}
	}
	if _, err := s.Assist(context.Background(), model.AIRequest{Action: "complete", Prefix: "SELECT"}); !errors.Is(err, ErrBusy) {
		t.Fatal(err)
	}
	for len(s.budget) > 0 {
		<-s.budget
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Assist(ctx, model.AIRequest{Action: "complete", Prefix: "SELECT"}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if len(s.budget) != 0 {
		t.Fatal("budget leaked")
	}
}

func (g *generator) Models(ctx context.Context, key string) ([]model.AIModel, error) {
	g.key = key
	return []model.AIModel{{ID: "deepseek-v4-pro", Name: "Pro"}}, nil
}
func TestConfiguredModelAndDisabledCompletion(t *testing.T) {
	g := &generator{content: `{"sql":"SELECT 1"}`}
	s := New(repository{data: `{"activeId":"a","configurations":[{"id":"a","provider":"deepseek","model":"deepseek-v4-pro","modelName":"deepseek-v4-pro","apiKey":"saved-key"}],"completionEnabled":false}`}, &connections{}, g)
	if _, err := s.Assist(context.Background(), model.AIRequest{Action: "complete", Prefix: "SELECT "}); err == nil || g.calls != 0 {
		t.Fatal("disabled completion reached upstream")
	}
	if _, err := s.Assist(context.Background(), model.AIRequest{Action: "optimize", SQL: "SELECT 1"}); err != nil || g.model != "deepseek-v4-pro" {
		t.Fatal(err, g.model)
	}
	values, err := s.Models(context.Background(), model.AIModelsRequest{Provider: "deepseek", ConfigID: "a"})
	if err != nil || len(values) != 1 || g.key != "saved-key" {
		t.Fatal(err, values)
	}
	_, err = s.Models(context.Background(), model.AIModelsRequest{Provider: "deepseek", APIKey: "new-key"})
	if err != nil || g.key != "new-key" {
		t.Fatal("edited key not used", err)
	}
}

func TestCompletionAcceptsAllKeywordCasesAndPreservesQuotedText(t *testing.T) {
	g := &generator{content: `{"completion":" 1;"}`}
	s := New(repository{}, &connections{}, g)
	for _, prefix := range []string{"select ", "SELECT ", "SeLeCt ", "select 'KeepCase' as `CaseSensitiveName`, "} {
		result, err := s.Assist(context.Background(), model.AIRequest{Action: "complete", Prefix: prefix, Suffix: " -- KeepComment"})
		if err != nil || result.Completion != " 1;" {
			t.Fatal(prefix, result, err)
		}
		var received model.AIRequest
		if json.Unmarshal([]byte(g.messages[1].Content), &received) != nil || received.Prefix != prefix || received.Suffix != " -- KeepComment" {
			t.Fatal("rewrote original SQL or dropped its context")
		}
	}
	if g.calls != 4 {
		t.Fatal("case variant skipped upstream")
	}
}

// 连接上下文由服务端从显式 ID 解析，不能把密码或客户端伪造的连接信息交给模型。
type namedConnection struct{}

func (namedConnection) Get(string) (model.Connection, error) {
	return model.Connection{Name: "测试连接", Type: "mysql", Host: "private-host", Username: "private-user", Password: "private-password"}, nil
}
func TestCompletionIncludesCommentsAndExplicitScopeWithoutCredentials(t *testing.T) {
	g := &generator{content: `{"completion":"select 1;"}`}
	s := New(repository{}, namedConnection{}, g)
	input := model.AIRequest{Action: "complete", ConnectionID: "alpha", Database: "demo", Table: "orders", Document: "-- 查询订单总数\n/* 只统计已完成订单 */\nselect ", Prefix: "-- 查询订单总数\nselect ", Suffix: " # 保留备注", Tables: []model.AITable{{Name: "orders", Comment: "订单表", Columns: []string{"id bigint -- 订单编号"}}}, Connection: &model.AIConnectionContext{Name: "forged"}}
	if _, err := s.Assist(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	var received model.AIRequest
	if json.Unmarshal([]byte(g.messages[1].Content), &received) != nil {
		t.Fatal("invalid context")
	}
	if received.Document != input.Document || received.Prefix != input.Prefix || received.Suffix != input.Suffix || received.Database != "demo" || received.Table != "orders" || received.Connection == nil || received.Connection.Name != "测试连接" || received.Connection.Type != "mysql" || received.Tables[0].Comment != "订单表" {
		t.Fatal("lost comments or scope")
	}
	for _, secret := range []string{"private-host", "private-user", "private-password", "forged"} {
		if strings.Contains(g.messages[1].Content, secret) {
			t.Fatal("unsafe connection context")
		}
	}
}

type dialectConnection string

func (d dialectConnection) Get(string) (model.Connection, error) {
	return model.Connection{Name: "dialect test", Type: string(d), Password: "private-password"}, nil
}

func TestMariaDBReturningOptimizationUsesDistinctDialect(t *testing.T) {
	for _, engine := range []string{model.TypeMySQL, model.TypeMariaDB, model.TypePostgreSQL} {
		t.Run(engine, func(t *testing.T) {
			sql := "REPLACE INTO sample VALUES (1) RETURNING id"
			g := &generator{content: `{"sql":"` + sql + `","explanation":"保持原语句"}`}
			s := New(repository{}, dialectConnection(engine), g)
			result, err := s.Assist(context.Background(), model.AIRequest{Action: "optimize", ConnectionID: "target", SQL: sql, Connection: &model.AIConnectionContext{Type: "forged"}})
			if err != nil || result.SQL != sql {
				t.Fatal(result, err)
			}
			var received model.AIRequest
			if err := json.Unmarshal([]byte(g.messages[1].Content), &received); err != nil || received.Connection == nil || received.Connection.Type != engine || received.SQL != sql {
				t.Fatal("lost authoritative engine or SQL", err, received)
			}
			if strings.Contains(g.messages[1].Content, "private-password") || strings.Contains(g.messages[1].Content, "forged") {
				t.Fatal("unsafe context")
			}
			if !strings.Contains(g.messages[0].Content, "mariadb") || !strings.Contains(g.messages[0].Content, "REPLACE and DELETE support RETURNING") {
				t.Fatal("MariaDB dialect support omitted from system instructions")
			}
		})
	}
}
