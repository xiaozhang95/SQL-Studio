package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"

	"sqldesk/internal/connection"
	"sqldesk/internal/mysql"
	"sqldesk/internal/service"
)

func TestRejectCrossSiteRequests(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	handler := New(service.New(store, mysql.NewClient()))
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
	handler := New(service.New(store, mysql.NewClient()))
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
	router := New(service.New(store, mysql.NewClient()))
	if routes := router.Routes(); len(routes) != 10 {
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
