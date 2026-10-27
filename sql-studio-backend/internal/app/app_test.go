package app

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
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
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err = application.Run(ctx); err != nil {
		t.Fatal(err)
	}
}
