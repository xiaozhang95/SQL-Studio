package agentstream

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func TestToolProtocol(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing auth")
		}
		var body struct {
			Model    string `json:"model"`
			Thinking struct {
				Type string `json:"type"`
			} `json:"thinking"`
			Tools []model.Tool `json:"tools"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Thinking.Type != "disabled" || body.Model != "test-model" || len(body.Tools) != 1 {
			t.Error("wrong protocol")
		}
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"tool_calls","message":{"role":"assistant","content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"list_tables","arguments":"{}"}}]}}]}`))
	}))
	defer upstream.Close()
	c := New(testCredentials{})
	c.endpoint = upstream.URL
	m, err := c.Generate(context.Background(), []model.Message{{Role: "user", Content: "hello"}}, []model.Tool{{Type: "function", Function: model.ToolDefinition{Parameters: json.RawMessage(`{}`)}}})
	if err != nil || len(m.ToolCalls) != 1 {
		t.Fatalf("%+v %v", m, err)
	}
}
func TestErrorsDoNotLeakCredentials(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		_, _ = w.Write([]byte("secret test-key"))
	}))
	defer upstream.Close()
	c := New(testCredentials{})
	c.endpoint = upstream.URL
	_, err := c.Generate(context.Background(), nil, nil)
	if err == nil || strings.Contains(err.Error(), "test-key") || strings.Contains(err.Error(), "secret") {
		t.Fatal("credential leak")
	}
}

type testCredentials struct{}

func (testCredentials) Credentials(context.Context) (model.AICredentials, error) {
	return model.AICredentials{APIKey: "test-key", Model: "test-model"}, nil
}

type liveCredentials struct{ value model.AICredentials }

func (c *liveCredentials) Credentials(context.Context) (model.AICredentials, error) {
	return c.value, nil
}
func TestNextRequestUsesUpdatedCredentials(t *testing.T) {
	provider := &liveCredentials{value: model.AICredentials{APIKey: "first-test-key", Model: "first-model"}}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+provider.value.APIKey {
			t.Error("used stale key")
		}
		var body struct {
			Model string `json:"model"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Model != provider.value.Model {
			t.Error("used stale model")
		}
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"hello"}}]}`))
	}))
	defer upstream.Close()
	client := New(provider)
	client.endpoint = upstream.URL
	if _, err := client.Generate(context.Background(), nil, nil); err != nil {
		t.Fatal(err)
	}
	provider.value = model.AICredentials{APIKey: "replacement-test-key", Model: "replacement-model"}
	if _, err := client.Generate(context.Background(), nil, nil); err != nil {
		t.Fatal(err)
	}
	provider.value.APIKey = ""
	if _, err := client.Generate(context.Background(), nil, nil); err == nil {
		t.Fatal("clear did not disable generation")
	}
}

func TestSummaryRequestOmitsToolsAndUsesSharedLimit(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		if _, exists := body["tools"]; exists {
			t.Error("summary sent tools:null")
		}
		var limit int
		_ = json.Unmarshal(body["max_tokens"], &limit)
		if limit != model.SummaryMaxTokens {
			t.Error("summary token limit drifted")
		}
		_, _ = w.Write([]byte(`{"choices":[{"finish_reason":"stop","message":{"role":"assistant","content":"摘要"}}]}`))
	}))
	defer server.Close()
	client := New(testCredentials{})
	client.endpoint = server.URL
	if _, err := client.Generate(context.Background(), []model.Message{{Role: "user", Content: "总结"}}, nil); err != nil {
		t.Fatal(err)
	}
}
