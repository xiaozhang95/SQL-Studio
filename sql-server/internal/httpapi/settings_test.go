package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http/httptest"
	"sql-studio/internal/model"
	"sql-studio/internal/modules/settings"
	"sql-studio/internal/statefile"
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
	if rec := call("PUT", "/api/state/ai", `{"revision":0,"data":{"provider":"deepseek","apiKey":"test-secret","model":"deepseek-flash"}}`); rec.Code != 200 {
		t.Fatal(rec.Code)
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
	doc, err := settings.New(reopened).Read(context.Background(), "ai")
	var config model.AIConfig
	if err != nil || json.Unmarshal(doc.Data, &config) != nil || config.Configured || config.CompletionEnabled == nil || *config.CompletionEnabled {
		t.Fatal("removed configuration returned after restart")
	}
}
