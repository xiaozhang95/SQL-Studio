package httpapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/ai"
	"strings"
	"testing"
)

type aiState struct{}

func (aiState) Read(context.Context, string) (model.StateDocument, error) {
	return model.StateDocument{Data: json.RawMessage(`{"activeId":"","configurations":[{"id":"a","provider":"deepseek","model":"deepseek-flash","modelName":"Flash","apiKey":"private-test-key"}]}`)}, nil
}

type aiConnections struct{}

func (aiConnections) Get(string) (model.Connection, error) { return model.Connection{}, nil }

type aiGenerator struct{}

func (aiGenerator) Generate(context.Context, string, string, []model.AIMessage, int) (string, error) {
	return `{"completion":"NOW();"}`, nil
}
func TestAIAssistRoutes(t *testing.T) {
	router := New(Services{AI: ai.New(aiState{}, aiConnections{}, aiGenerator{})})
	for _, item := range []struct {
		body   string
		status int
	}{
		{`{"action":"complete","prefix":"SELECT "}`, 200},
		{`{"action":"complete","prefix":"SELECT ","unexpected":1}`, 400},
		{`{"action":"complete","prefix":"SELECT "} {}`, 400},
		{`{"action":"optimize","sql":" "}`, 400},
	} {
		req := httptest.NewRequest("POST", "http://127.0.0.1:8080/api/ai/assist", strings.NewReader(item.body))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != item.status || strings.Contains(rec.Body.String(), "private-test-key") {
			t.Fatal(rec.Code, rec.Body.String())
		}
	}
}

func (aiGenerator) Models(context.Context, string) ([]model.AIModel, error) {
	return []model.AIModel{{ID: "deepseek-flash", Name: "Flash"}, {ID: "deepseek-v4-pro", Name: "Pro"}}, nil
}
func TestAIModelDiscoveryRoute(t *testing.T) {
	router := New(Services{AI: ai.New(aiState{}, aiConnections{}, aiGenerator{})})
	for _, item := range []struct {
		body   string
		status int
	}{
		{`{"provider":"deepseek","configId":"a"}`, 200},
		{`{"provider":"deepseek"}`, 400},
		{`{"provider":"deepseek","apiKey":"temporary-key"}`, 200},
		{`{"provider":"unknown"}`, 400},
		{`{"provider":"deepseek","unexpected":true}`, 400},
	} {
		req := httptest.NewRequest("POST", "http://127.0.0.1:8080/api/ai/models", strings.NewReader(item.body))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != item.status || strings.Contains(rec.Body.String(), "private-test-key") || strings.Contains(rec.Body.String(), "temporary-key") {
			t.Fatal(rec.Code, rec.Body.String())
		}
	}
}
