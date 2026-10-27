package httpapi

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
)

func TestSessionRouteValidationScopeAndCloseFailure(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "fixture", Host: "fixture", Port: 3306, Username: "test", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	calls := 0
	var failure error
	db := routeDatabase{session: func(ctx context.Context, c model.Connection, database *string, open bool) error {
		calls++
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 7*time.Second || c.ID != saved.ID || c.Password != "secret" {
			t.Fatal("session scope or timeout lost")
		}
		if database != nil && *database != "shared db" {
			t.Fatal("database changed")
		}
		return failure
	}}
	router := New(regressionServices(store, db))
	endpoint := "http://127.0.0.1:8080/api/connections/" + saved.ID + "/session"
	post := func(body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest("POST", endpoint, strings.NewReader(body)))
		return rec
	}
	for _, body := range []string{`{}`, `null`, `{"open":null}`, `{"open":false,"database":null}`, `{"open":false,"database":""}`, `{"open":false,"database":1}`, `{"open":false,"extra":1}`} {
		if rec := post(body); rec.Code != 400 {
			t.Fatalf("invalid request accepted: %s %d", body, rec.Code)
		}
	}
	if calls != 0 {
		t.Fatal("invalid input reached lifecycle")
	}
	for _, body := range []string{`{"open":false}`, `{"open":true}`, `{"open":false,"database":"shared db"}`, `{"open":true,"database":"shared db"}`} {
		if rec := post(body); rec.Code != 200 || strings.Contains(rec.Body.String(), "secret") {
			t.Fatalf("session route failed: %d %s", rec.Code, rec.Body.String())
		}
	}
	failure = errors.New("driver did not close")
	if rec := post(`{"open":false}`); rec.Code != 400 || !strings.Contains(rec.Body.String(), "driver did not close") {
		t.Fatal("failed close reported success")
	}
}
