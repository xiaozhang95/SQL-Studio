package agent

import (
	"context"
	"errors"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func longHistory() []model.Message {
	out := []model.Message{{Role: "system", Content: "rules"}}
	for i := 0; i < 8; i++ {
		out = append(out, model.Message{Role: "user", Content: strings.Repeat("question ", 200)}, model.Message{Role: "assistant", Reasoning: strings.Repeat("official ", 60), ToolCalls: []model.ToolCall{{ID: "call", Type: "function", Function: model.Function{Name: "query_readonly", Arguments: `{"sql":"SELECT 1"}`}}}}, model.Message{Role: "tool", ToolCallID: "call", Content: strings.Repeat("result ", 250)}, model.Message{Role: "assistant", Content: strings.Repeat("conclusion ", 150)})
	}
	out = append(out, model.Message{Role: "user", Content: "current question"})
	return out
}
func TestCompressionPreservesOriginalAndRecentToolPairs(t *testing.T) {
	source := longHistory()
	before := len(source)
	summaries := 0
	approved := false
	s := New(generatorFunc(func(_ context.Context, m []model.Message, tools []model.Tool) (model.Message, error) {
		summaries++
		if !approved || len(tools) != 0 || !strings.Contains(m[0].Content, "摘要") {
			t.Fatal("summary attempted tools")
		}
		return model.Message{Role: "assistant", Content: "用户要按天统计订单；demo库；已确认按支付时间。"}, nil
	}), &fakeDB{})
	request, summary, err := s.prepare(context.Background(), source, model.ContextSummary{}, model.Target{ConnectionID: "a", Database: "demo"}, 15000, tools(), model.Message{Role: "system", Content: "只读"}, func(model.Event) error { return nil }, func() error {
		approved = true
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if summaries == 0 || summary.Through == 0 || len(source) != before || source[summary.Through].Role != "user" || estimate(request, tools()) > 15000 {
		t.Fatal("invalid compression boundary")
	}
	assistantCalls, results := 0, 0
	reasoning := false
	for _, m := range request {
		if len(m.ToolCalls) > 0 {
			assistantCalls++
			if m.Reasoning != "" {
				reasoning = true
			}
		}
		if m.Role == "tool" {
			results++
		}
	}
	if assistantCalls != results || !reasoning || !strings.Contains(request[2].Content, "支付时间") {
		t.Fatal("lost recent tools/reasoning or facts")
	}
}
func TestCompressionFailureDoesNotReplaceSummary(t *testing.T) {
	prior := model.ContextSummary{Through: 1, Text: "existing summary"}
	s := New(generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
		return model.Message{}, errors.New("mock upstream failed")
	}), &fakeDB{})
	_, got, err := s.prepare(context.Background(), longHistory(), prior, model.Target{}, 15000, tools(), model.Message{Role: "system", Content: "只读"}, func(model.Event) error { return nil })
	if err == nil || got != prior {
		t.Fatal("failed summary replaced state")
	}
}
