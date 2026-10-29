package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
)

func TestGroupRoutesSharePersistedListWithoutDatabaseSession(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "one", Host: "host", Group: "原分组", Password: "http-group-secret"})
	if err != nil {
		t.Fatal(err)
	}
	// 未注入数据库：分组 API 必须只操作本地元数据。
	router := New(Services{Connections: connections.New(store, nil)})
	call := func(method, path, body string, status int) []byte {
		t.Helper()
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, "http://127.0.0.1:8080/api"+path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(recorder, request)
		if recorder.Code != status {
			t.Fatalf("%s %s: %d %s", method, path, recorder.Code, recorder.Body.String())
		}
		if strings.Contains(recorder.Body.String(), "http-group-secret") || strings.Contains(recorder.Body.String(), `"password"`) {
			t.Fatal("credentials leaked")
		}
		return recorder.Body.Bytes()
	}
	call("POST", "/connection-groups", `{"name":"空分组"}`, 200)
	call("POST", "/connection-groups", `{"name":"空分组"}`, 400)
	call("POST", "/connection-groups", `{"name":"other","unknown":true}`, 400)
	call("POST", "/connection-groups/rename", `{"name":"原分组","newName":"新分组"}`, 200)
	call("PATCH", "/connections/"+saved.ID+"/group", `{"group":"不存在"}`, 400)
	call("PATCH", "/connections/"+saved.ID+"/group", `{"group":"空分组"}`, 200)
	call("PATCH", "/connections/missing/group", `{"group":"空分组"}`, 404)
	var groups []string
	if err = json.Unmarshal(call("GET", "/connection-groups", "", 200), &groups); err != nil || len(groups) != 3 {
		t.Fatal("shared group list invalid")
	}
	var listed []model.Connection
	if err = json.Unmarshal(call("GET", "/connections", "", 200), &listed); err != nil || len(listed) != 1 || listed[0].Group != "空分组" {
		t.Fatal("move/rename not reflected in connection list")
	}
}

func TestDeleteGroupRoutePreservesConnectionsAndRejectsReservedOrInvalidInput(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "member", Group: "to-delete", Password: "deletion-secret"})
	if err != nil {
		t.Fatal(err)
	}
	router := New(Services{Connections: connections.New(store, nil)})
	call := func(body string, status int) []byte {
		t.Helper()
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("DELETE", "http://127.0.0.1:8080/api/connection-groups", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		router.ServeHTTP(rec, req)
		if rec.Code != status {
			t.Fatalf("delete: %d %s", rec.Code, rec.Body.String())
		}
		if strings.Contains(rec.Body.String(), "deletion-secret") || strings.Contains(rec.Body.String(), `"password"`) {
			t.Fatal("credentials exposed")
		}
		return rec.Body.Bytes()
	}
	call(`{"name":"默认分组"}`, 400)
	call(`{"name":"missing"}`, 404)
	call(`{"name":"to-delete","unknown":true}`, 400)
	call(`null`, 400)
	var state connections.GroupState
	if err = json.Unmarshal(call(`{"name":"to-delete"}`, 200), &state); err != nil {
		t.Fatal(err)
	}
	if len(state.Groups) != 1 || state.Groups[0] != model.DefaultConnectionGroup || len(state.Connections) != 1 || state.Connections[0].ID != saved.ID || state.Connections[0].Group != model.DefaultConnectionGroup || !state.Connections[0].HasPassword {
		t.Fatalf("invalid delete state: %#v", state)
	}
	raw, err := store.Get(saved.ID)
	if err != nil || raw.Password != "deletion-secret" {
		t.Fatal("deleted member or credential", err)
	}
}
