package deepseek

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func TestStreamAcceptsMoreThanFourToolCalls(t *testing.T) {
	var raw strings.Builder
	for i := 0; i < 8; i++ {
		fmt.Fprintf(&raw, "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":%d,\"id\":\"tool-%d\",\"type\":\"function\",\"function\":{\"name\":\"list_connections\",\"arguments\":\"{}\"}}]}}]}\n\n", i, i)
	}
	raw.WriteString("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"tool_calls\"}]}\n\ndata: [DONE]\n\n")
	m, err := parseStream(context.Background(), strings.NewReader(raw.String()), func(model.Event) error { return nil })
	if err != nil || len(m.ToolCalls) != 8 {
		t.Fatal(len(m.ToolCalls), err)
	}
}

func TestStreamingThinkingToolFragmentsAndUsage(t *testing.T) {
	frames := []string{
		`{"choices":[{"delta":{"role":"assistant","reasoning_content":"先确认目标"}}]}`,
		`{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tool-1","type":"function","function":{"name":"list_","arguments":"{"}}]}}]}`,
		`{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"connections","arguments":"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":42,"completion_tokens":9}}`,
		`[DONE]`}
	raw := ""
	for _, frame := range frames {
		raw += "data: " + frame + "\n\n"
	}
	var events []model.Event
	m, err := parseStream(context.Background(), strings.NewReader(raw), func(e model.Event) error { events = append(events, e); return nil })
	if err != nil {
		t.Fatal(err)
	}
	if m.Reasoning != "先确认目标" || len(m.ToolCalls) != 1 || m.ToolCalls[0].Function.Name != "list_connections" || m.ToolCalls[0].Function.Arguments != "{}" {
		t.Fatalf("bad aggregation: %+v", m)
	}
	if events[0].Type != "reasoning_delta" || events[1].Usage.Prompt != 42 {
		t.Fatal("lost stream events")
	}
}
func TestTruncatedAndIncompleteToolsNeverAccepted(t *testing.T) {
	for _, raw := range []string{`data: {"choices":[{"delta":{"content":"partial"}}]}` + "\n\n", `data: {"choices":[{"delta":{"content":"partial"},"finish_reason":"length"}]}` + "\n\ndata: [DONE]\n\n", `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"type":"function","function":{"name":"query_readonly","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}` + "\n\ndata: [DONE]\n\n"} {
		if _, err := parseStream(context.Background(), strings.NewReader(raw), func(model.Event) error { return nil }); err == nil {
			t.Fatal("accepted incomplete stream")
		}
	}
}
func TestStreamingRequestPreservesReasoningHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Stream   bool `json:"stream"`
			Thinking struct {
				Type string `json:"type"`
			} `json:"thinking"`
			Messages []model.Message `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if !body.Stream || body.Thinking.Type != "enabled" || body.Messages[1].Reasoning != "prior official reasoning" {
			t.Error("lost thinking protocol")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = w.Write([]byte("data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"thinking\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"answer\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n"))
	}))
	defer server.Close()
	c := New(testCredentials{})
	c.endpoint = server.URL
	m, err := c.GenerateStream(context.Background(), []model.Message{{Role: "user", Content: "hello"}, {Role: "assistant", Content: "prior", Reasoning: "prior official reasoning"}}, nil, func(model.Event) error { return nil })
	if err != nil || m.Content != "answer" || m.Reasoning != "thinking" {
		t.Fatal(m, err)
	}
}
