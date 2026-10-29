package app

import (
	"bytes"
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"sql-studio-backend/internal/config"
	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
)

func TestBootstrapKeepsExistingCredentialsAndServesWeb(t *testing.T) {
	dir := t.TempDir()
	web := t.TempDir()
	if err := os.WriteFile(filepath.Join(web, "index.html"), []byte("SQL Studio test page"), 0600); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{Address: "127.0.0.1:0", DataDir: dir, WebDir: web, InitialConnection: &model.Connection{Name: "initial", Host: "localhost", Port: 3306, Username: "root", Password: "first-secret"}}
	application, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	cfg.InitialConnection.Password = "replacement-secret"
	if _, err = New(cfg); err != nil {
		t.Fatal(err)
	}
	repo, err := connection.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := repo.Get(repo.List()[0].ID)
	if err != nil || saved.Password != "first-secret" {
		t.Fatal("bootstrap overwrote existing credentials")
	}
	for _, path := range []string{"/", "/api/health", "/api/connections"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "http://127.0.0.1:8080"+path, nil)
		application.server.Handler.ServeHTTP(rec, req)
		if rec.Code != 200 {
			t.Fatalf("%s: %d", path, rec.Code)
		}
	}
	for _, path := range []string{"/api", "/api/missing"} {
		rec := httptest.NewRecorder()
		application.server.Handler.ServeHTTP(rec, httptest.NewRequest("GET", "http://127.0.0.1:8080"+path, nil))
		if rec.Code != 404 || !strings.Contains(rec.Header().Get("Content-Type"), "application/json") || !strings.Contains(rec.Body.String(), "接口不存在") {
			t.Fatalf("unknown API fell through to frontend: %s: %d %s", path, rec.Code, rec.Body.String())
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err = application.Run(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestStartupMigratesCredentialsIntoSharedUserDirectory(t *testing.T) {
	legacy, destination := t.TempDir(), t.TempDir()
	repository, err := connection.Open(legacy)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := repository.Save(model.Connection{Name: "migration fixture", Host: "fixture", Port: 3306, Username: "test", Password: "original-secret"})
	if err != nil {
		t.Fatal(err)
	}
	application, err := New(config.Config{Address: "127.0.0.1:0", DataDir: destination, StateDir: destination, LegacyDataDir: legacy, WebDir: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	store, err := connection.Open(destination)
	if err != nil {
		t.Fatal(err)
	}
	loaded, err := store.Get(saved.ID)
	if err != nil || loaded.Password != "original-secret" {
		t.Fatal("startup migration lost credentials", err)
	}
	for _, method := range []string{"GET", "PUT"} {
		rec := httptest.NewRecorder()
		application.server.Handler.ServeHTTP(rec, httptest.NewRequest(method, "http://127.0.0.1:8080/api/state/connections", bytes.NewBufferString(`{"revision":0,"data":{}}`)))
		if rec.Code != 400 || strings.Contains(rec.Body.String(), "original-secret") {
			t.Fatal("connection file exposed through state route")
		}
	}
	if _, err = os.Stat(filepath.Join(legacy, "master.key")); !os.IsNotExist(err) {
		t.Fatal("legacy key retained")
	}
}
