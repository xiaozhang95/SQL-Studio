package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/settings"
	"sql-studio-backend/internal/statefile"
	"testing"
)

func TestUserStateRoutes(t *testing.T) {
	store, _ := statefile.Open(t.TempDir())
	router := New(Services{Settings: settings.New(store)})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, "http://127.0.0.1:8080/api/state/"+path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(rec, req)
		return rec
	}
	rec := call("GET", "workspace", "")
	var doc model.StateDocument
	if json.Unmarshal(rec.Body.Bytes(), &doc) != nil || rec.Code != 200 || doc.Revision != 0 {
		t.Fatal(rec.Code, rec.Body.String())
	}
	rec = call("PUT", "workspace", `{"revision":0,"data":{"version":1,"tabs":[]}}`)
	if rec.Code != 200 {
		t.Fatal(rec.Code, rec.Body.String())
	}
	rec = call("GET", "workspace", "")
	_ = json.Unmarshal(rec.Body.Bytes(), &doc)
	if doc.Revision != 1 {
		t.Fatal(doc)
	}
	if rec = call("PUT", "workspace", `{"revision":0,"data":{}}`); rec.Code != 409 {
		t.Fatal(rec.Code)
	}
	for _, body := range []string{`{"revision":1,"data":null}`, `{"revision":1,"data":{},"extra":true}`, `{"revision":1,"data":{}}{}`} {
		if rec = call("PUT", "workspace", body); rec.Code != 400 {
			t.Fatal(rec.Code, body)
		}
	}
	if rec = call("GET", "UPPER", ""); rec.Code != 400 {
		t.Fatal(rec.Code)
	}
}

func TestRemoveAIConfigRoute(t *testing.T) {
	directory := t.TempDir()
	store, _ := statefile.Open(directory)
	router := New(Services{Settings: settings.New(store)})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, "http://127.0.0.1:8080"+path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(rec, req)
		return rec
	}
	saved := call("PUT", "/api/state/ai-models", `{"revision":0,"data":{"activeId":"","configurations":[{"id":"a","provider":"deepseek","model":"deepseek-flash","modelName":"deepseek-flash","apiKey":"test-secret"}]}}`)
	var selected struct {
		Data model.AIConfig `json:"data"`
	}
	if saved.Code != 200 || json.Unmarshal(saved.Body.Bytes(), &selected) != nil || selected.Data.ActiveID != "a" {
		t.Fatal("first saved model was not returned as the default", saved.Code)
	}
	if rec := call("DELETE", "/api/ai/config", `{"revision":0}`); rec.Code != 409 {
		t.Fatal("missing revision protection", rec.Code)
	}
	if rec := call("DELETE", "/api/ai/config", `{"revision":1,"unknown":true}`); rec.Code != 400 {
		t.Fatal("unknown field accepted", rec.Code)
	}
	rec := call("DELETE", "/api/ai/config", `{"revision":1}`)
	if rec.Code != 200 || bytes.Contains(rec.Body.Bytes(), []byte("test-secret")) {
		t.Fatal("delete failed or exposed key", rec.Code)
	}
	reopened, _ := statefile.Open(directory)
	doc, err := settings.New(reopened).Read(context.Background(), model.AIModelsSection)
	var config model.AIConfig
	if err != nil || json.Unmarshal(doc.Data, &config) != nil || len(config.Configurations) != 0 || config.CompletionEnabled == nil || *config.CompletionEnabled {
		t.Fatal("removed configuration returned after restart")
	}
}

// null 曾被当成 revision=0 的请求，导致缺失 AI 分区被意外创建；无效 JSON 不应改写配置。
func TestInvalidJSONDoesNotCreateAIConfig(t *testing.T) {
	store, err := statefile.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	router := New(Services{Settings: settings.New(store)})
	for _, body := range []string{"null", " \n null", "[]", "true", `{}`, `{"revision":null}`, `{"revision":0} {}`} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest("DELETE", "http://127.0.0.1:8080/api/ai/config", bytes.NewBufferString(body)))
		if rec.Code != 400 {
			t.Fatalf("invalid input %q returned %d", body, rec.Code)
		}
		doc, err := store.Read(context.Background(), model.AIModelsSection)
		if err != nil || doc.Revision != 0 {
			t.Fatalf("invalid request mutated configuration: %+v, %v", doc, err)
		}
	}
}

func TestStateWriteRequiresRevision(t *testing.T) {
	store, err := statefile.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	router := New(Services{Settings: settings.New(store)})
	for _, body := range []string{`{"data":{}}`, `{"revision":null,"data":{}}`} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest("PUT", "http://127.0.0.1:8080/api/state/workspace", bytes.NewBufferString(body)))
		if rec.Code != 400 {
			t.Fatalf("missing revision accepted: %d", rec.Code)
		}
	}
	doc, err := store.Read(context.Background(), "workspace")
	if err != nil || doc.Revision != 0 {
		t.Fatal("invalid request created configuration", err)
	}
}

func TestNewModelListDoesNotReadOrModifyObsoleteAIFile(t *testing.T) {
	ctx := context.Background()
	store, err := statefile.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	obsolete := json.RawMessage(`{"provider":"deepseek","apiKey":"fixture-obsolete-key","model":"obsolete-model"}`)
	if _, err = store.Write(ctx, "ai", model.StateWrite{Data: obsolete}); err != nil {
		t.Fatal(err)
	}
	router := New(Services{Settings: settings.New(store)})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(method, "http://127.0.0.1:8080"+path, bytes.NewBufferString(body)))
		return rec
	}
	result := call("GET", "/api/state/ai-models", "")
	var doc model.StateDocument
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &doc) != nil || doc.Revision != 0 || string(doc.Data) != "null" {
		t.Fatal("obsolete format blocked empty new list", result.Code)
	}
	if old := call("GET", "/api/state/ai", ""); old.Code != 400 || bytes.Contains(old.Body.Bytes(), []byte("fixture-obsolete-key")) {
		t.Fatal("obsolete secret was exposed")
	}
	body := `{"revision":0,"data":{"activeId":"","configurations":[{"id":"new","provider":"deepseek","model":"model-a","modelName":"Model A","apiKey":"fixture-new-key"}]}}`
	result = call("PUT", "/api/state/ai-models", body)
	if result.Code != 200 || bytes.Contains(result.Body.Bytes(), []byte("fixture-new-key")) {
		t.Fatal("new list could not be saved or key leaked", result.Code)
	}
	result = call("GET", "/api/state/ai-models", "")
	var config model.AIConfig
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &doc) != nil || json.Unmarshal(doc.Data, &config) != nil || len(config.Configurations) != 1 || config.Configurations[0].ModelName != "Model A" {
		t.Fatal("new list could not be restored")
	}
	previous, err := store.Read(ctx, "ai")
	if err != nil || !bytes.Equal(previous.Data, obsolete) {
		t.Fatal("obsolete file was changed", err)
	}
}
