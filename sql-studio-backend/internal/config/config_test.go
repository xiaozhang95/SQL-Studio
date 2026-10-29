package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadPathsAndInitialConnection(t *testing.T) {
	t.Setenv("SQLDESK_ADDR", "")
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

func TestListenAddressOverride(t *testing.T) {
	t.Setenv("SQLDESK_DATA_DIR", t.TempDir())
	t.Setenv("SQLDESK_STATE_DIR", t.TempDir())
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	t.Setenv("SQLDESK_ADDR", "127.0.0.1:18080")
	cfg, err := Load()
	if err != nil || cfg.Address != "127.0.0.1:18080" {
		t.Fatalf("listen address override: %q, %v", cfg.Address, err)
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

func TestDefaultWebDirectory(t *testing.T) {
	t.Setenv("SQLDESK_WEB_DIR", "")
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	t.Setenv("SQLDESK_DATA_DIR", t.TempDir())
	t.Setenv("SQLDESK_STATE_DIR", t.TempDir())
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.WebDir != "" {
		t.Fatalf("default web source must be selected by the build, got %q", cfg.WebDir)
	}
}

func TestConnectionDataUsesUserStateDirectoryByDefault(t *testing.T) {
	home := t.TempDir()
	t.Setenv("USERPROFILE", home)
	t.Setenv("HOME", home)
	t.Setenv("SQLDESK_DATA_DIR", "")
	t.Setenv("SQLDESK_STATE_DIR", "")
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DataDir != filepath.Join(home, ".sql-studio", "state") || cfg.DataDir != cfg.StateDir || cfg.LegacyDataDir == "" {
		t.Fatal("default data is not colocated with user state")
	}
	t.Setenv("SQLDESK_STATE_DIR", filepath.Join(home, "custom-state"))
	cfg, err = Load()
	if err != nil || cfg.DataDir != cfg.StateDir {
		t.Fatal("data did not follow explicit state directory", err)
	}
	t.Setenv("SQLDESK_DATA_DIR", filepath.Join(home, "custom-connections"))
	cfg, err = Load()
	if err != nil || cfg.DataDir != filepath.Join(home, "custom-connections") || cfg.LegacyDataDir != "" {
		t.Fatal("explicit data directory changed or triggered migration", err)
	}
}
