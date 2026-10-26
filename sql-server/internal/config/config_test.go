package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPathsAndInitialConnection(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("SQLDESK_DATA_DIR", filepath.Join(dir, "connections"))
	t.Setenv("SQLDESK_WEB_DIR", filepath.Join(dir, "web"))
	t.Setenv("SQLDESK_STATE_DIR", filepath.Join(dir, "state"))
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "test-secret")
	t.Setenv("SQLDESK_MYSQL_HOST", "localhost")
	t.Setenv("SQLDESK_MYSQL_PORT", "3307")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.StateDir != filepath.Join(dir, "state") || cfg.Address != "127.0.0.1:8080" || cfg.InitialConnection == nil || cfg.InitialConnection.Port != 3307 || cfg.InitialConnection.Host != "localhost" || !filepath.IsAbs(cfg.DataDir) || !filepath.IsAbs(cfg.WebDir) {
		t.Fatal("configuration not applied")
	}
	t.Setenv("SQLDESK_MYSQL_PORT", "65536")
	if _, err = Load(); err == nil {
		t.Fatal("invalid port accepted")
	}
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	cfg, err = Load()
	if err != nil || cfg.InitialConnection != nil {
		t.Fatal("empty password should not seed a connection")
	}
}

func TestStateDirectoryNameCompatibility(t *testing.T) {
	home := t.TempDir()
	current := filepath.Join(home, ".sql-studio", "state")
	legacy := filepath.Join(home, ".sqloom", "state")
	if defaultStateDirectory(home) != current {
		t.Fatal("new name")
	}
	if err := os.MkdirAll(legacy, 0700); err != nil {
		t.Fatal(err)
	}
	if defaultStateDirectory(home) != legacy {
		t.Fatal("legacy lost")
	}
	if err := os.MkdirAll(current, 0700); err != nil {
		t.Fatal(err)
	}
	if defaultStateDirectory(home) != current {
		t.Fatal("new must win")
	}
}
