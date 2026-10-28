package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/workspace"
	"sql-studio-backend/internal/statefile"
	"strings"
	"testing"
)

func TestSplitWorkspaceRoutesAndBoundaries(t *testing.T) {
	store, err := statefile.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	router := New(Services{Workspace: workspace.New(store)})
	call := func(method, path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(method, "http://127.0.0.1/api"+path, strings.NewReader(body)))
		return rec
	}
	get := call("GET", "/workspace", "")
	var doc model.WorkspaceDocument
	if get.Code != 200 || json.Unmarshal(get.Body.Bytes(), &doc) != nil || doc.Revision != 1 {
		t.Fatal(get.Body.String())
	}
	doc.Index.Tabs = []model.WorkspacePage{{ID: "p", Kind: "query", Title: "draft"}}
	doc.Index.ActiveTab = "p"
	input := model.WorkspaceCommit{Revision: 1, Index: doc.Index, Drafts: map[string]string{"p": "SELECT 'not executed';"}}
	bytes, _ := json.Marshal(input)
	saved := call("PUT", "/workspace", string(bytes))
	if saved.Code != 200 || json.Unmarshal(saved.Body.Bytes(), &doc) != nil {
		t.Fatal(saved.Body.String())
	}
	if strings.Contains(saved.Body.String(), "not executed") {
		t.Fatal("save echoed draft")
	}
	part := call("GET", "/workspace/parts/"+doc.Index.Tabs[0].DraftRef, "")
	if part.Code != 200 || !strings.Contains(part.Body.String(), "not executed") {
		t.Fatal(part.Body.String())
	}
	if call("PUT", "/workspace", string(bytes)).Code != 409 {
		t.Fatal("CAS not enforced")
	}
	for _, body := range []string{`null`, `{}`, `{"revision":null}`, `{"revision":2,"unknown":true}`} {
		if call("PUT", "/workspace", body).Code != 400 {
			t.Fatal("invalid body accepted", body)
		}
	}
	if call("GET", "/workspace/parts/not-a-hash", "").Code != 400 {
		t.Fatal("invalid hash accepted")
	}
	if call("GET", "/workspace/parts/"+strings.Repeat("a", 64), "").Code != 404 {
		t.Fatal("missing blob not 404")
	}
}
