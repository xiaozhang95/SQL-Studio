package httpapi

import (
	"bytes"
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
