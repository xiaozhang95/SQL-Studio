package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/mysql"
)

func TestConnectionGroupRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := connection.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	handler := New(testServices(store))
	save := func(input model.Connection) model.Connection {
		t.Helper()
		body, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest("POST", "http://127.0.0.1:8080/api/connections", strings.NewReader(string(body))))
		var saved model.Connection
		if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &saved) != nil {
			t.Fatalf("save failed: %s", rec.Body.String())
		}
		if saved.Password != "" {
			t.Fatal("group edit exposed credentials")
		}
		return saved
	}
	saved := save(model.Connection{Name: "grouped", Group: "  开发 / 🧪 \"测试\"  ", Host: "localhost", Port: 3306, Username: "user", Password: "group-test-secret"})
	if saved.Group != "开发 / 🧪 \"测试\"" {
		t.Fatalf("group was not trimmed: %q", saved.Group)
	}
	store, err = connection.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	handler = New(testServices(store))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections", nil))
	var listed []model.Connection
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &listed) != nil || len(listed) != 1 || listed[0].Group != saved.Group {
		t.Fatal("group was lost after reopening the store")
	}
	for _, group := range []string{"生产环境", " \t "} {
		want := strings.TrimSpace(group)
		if want == "" {
			want = model.DefaultConnectionGroup
		}
		saved.Group = group
		saved = save(saved)
		loaded, err := store.Get(saved.ID)
		if err != nil || loaded.Group != want || saved.Group != want || loaded.Password != "group-test-secret" {
			t.Fatal("moving or clearing group lost metadata or credentials")
		}
	}
}

func TestLegacyConnectionsBelongToDefaultGroup(t *testing.T) {
	dir := t.TempDir()
	store, err := connection.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	for _, group := range []string{"", " \t "} {
		if _, err := store.Save(model.Connection{Name: "legacy", Group: group, Password: "legacy-secret"}); err != nil {
			t.Fatal(err)
		}
	}
	filename := filepath.Join(dir, "connections.json")
	before, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	New(testServices(store)).ServeHTTP(rec, httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections", nil))
	var listed []model.Connection
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &listed) != nil || len(listed) != 2 {
		t.Fatal("legacy connections were lost")
	}
	for _, item := range listed {
		if item.Group != model.DefaultConnectionGroup || item.Password != "" {
			t.Fatal("legacy connection did not use default group or exposed credentials")
		}
	}
	after, err := os.ReadFile(filename)
	if err != nil || !bytes.Equal(before, after) {
		t.Fatal("listing legacy groups rewrote the existing configuration")
	}
}

func TestRejectCrossSiteRequests(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	handler := New(testServices(store))
	for _, test := range []struct {
		host, origin, fetch string
		want                int
	}{{"127.0.0.1:8080", "http://evil.example", "", 403}, {"evil.example", "", "", 403}, {"127.0.0.1:8080", "", "cross-site", 403}, {"127.0.0.1:5173", "http://127.0.0.1:5173", "same-origin", 200}, {"127.0.0.1:8080", "", "", 200}} {
		req := httptest.NewRequest("GET", "http://"+test.host+"/api/connections", nil)
		req.Header.Set("Origin", test.origin)
		req.Header.Set("Sec-Fetch-Site", test.fetch)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != test.want {
			t.Fatalf("host %s origin %s: got %d", test.host, test.origin, rec.Code)
		}
	}
	req := httptest.NewRequest("POST", "http://127.0.0.1:8080/api/connections", strings.NewReader(`{"name":"a","host":"b","port":3306,"username":"u"} {}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatal("trailing JSON accepted")
	}
}

func TestConnectionAPIDoesNotExposePasswords(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	handler := New(testServices(store))
	req := httptest.NewRequest("POST", "http://127.0.0.1:8080/api/connections", strings.NewReader(`{"name":"test","host":"localhost","port":3306,"username":"root","password":"private-secret"}`))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatal(rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "private-secret") || strings.Contains(rec.Body.String(), `"password"`) {
		t.Fatal("save response leaked password")
	}
	req = httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 200 || strings.Contains(rec.Body.String(), `"password"`) {
		t.Fatal("list response leaked password")
	}
	req = httptest.NewRequest("GET", "http://127.0.0.1:8080/api/connections/missing/databases", nil)
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != 404 {
		t.Fatal("missing connection should be 404")
	}
}

func TestGinRouteParametersAndConnectionTypes(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	router := New(testServices(store))
	if routes := router.Routes(); len(routes) != 40 {
		t.Fatalf("unexpected Gin routes: %d", len(routes))
	}
	req := httptest.NewRequest("POST", "http://127.0.0.1:8080/api/connections", strings.NewReader(`{"type":"mysql","tls":true,"name":"cloud","host":"db.example","port":3306,"username":"user","password":"secret"}`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"type":"mysql"`) {
		t.Fatal(rec.Body.String())
	}
	id := store.List()[0].ID
	req = httptest.NewRequest("DELETE", "http://127.0.0.1:8080/api/connections/"+id, nil)
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != 200 || len(store.List()) != 0 {
		t.Fatal("Gin parameter routing failed")
	}
	req = httptest.NewRequest("POST", "http://127.0.0.1:8080/api/connections", strings.NewReader(`{"type":"unknown","name":"bad","host":"localhost","port":3306,"username":"user"}`))
	rec = httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != 400 {
		t.Fatal("unknown database type accepted")
	}
}

func testServices(store *connection.Store) Services {
	client := mysql.NewClient()
	return Services{Connections: connections.New(store, client), Metadata: metadata.New(store, client), Queries: query.New(store, client)}
}
