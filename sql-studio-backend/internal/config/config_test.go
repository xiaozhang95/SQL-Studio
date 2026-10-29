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

func TestDefaultConfigurationFollowsStartupWorkingDirectory(t *testing.T) {
	t.Setenv("SQLDESK_DATA_DIR", "")
	t.Setenv("SQLDESK_STATE_DIR", "")
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	t.Setenv("SQLDESK_WEB_DIR", "")
	first, second := t.TempDir(), t.TempDir()
	for _, dir := range []string{first, second} {
		t.Chdir(dir)
		// A stale folder name must not override the requested startup-relative location.
		if err := os.MkdirAll(filepath.Join(dir, ".sqloom", "state"), 0700); err != nil {
			t.Fatal(err)
		}
		cfg, err := Load()
		if err != nil {
			t.Fatal(err)
		}
		want := filepath.Join(dir, ".sql-studio", "state")
		if cfg.StateDir != want || cfg.DataDir != want || cfg.LegacyDataDir != filepath.Join(dir, "data") {
			t.Fatalf("cwd %s: %#v", dir, cfg)
		}
		if _, err := os.Stat(want); !os.IsNotExist(err) {
			t.Fatalf("Load must not create configuration files: %v", err)
		}
	}
}
func TestRelativeConfigurationOverridesUseWorkingDirectory(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	t.Setenv("SQLDESK_MYSQL_PASSWORD", "")
	t.Setenv("SQLDESK_WEB_DIR", "")
	t.Setenv("SQLDESK_DATA_DIR", "")
	t.Setenv("SQLDESK_STATE_DIR", "custom-state")
	cfg, err := Load()
	if err != nil || cfg.StateDir != filepath.Join(dir, "custom-state") || cfg.DataDir != cfg.StateDir {
		t.Fatal("relative state override", cfg, err)
	}
	t.Setenv("SQLDESK_DATA_DIR", "custom-connections")
	cfg, err = Load()
	if err != nil || cfg.DataDir != filepath.Join(dir, "custom-connections") || cfg.LegacyDataDir != "" {
		t.Fatal("relative data override", cfg, err)
	}
}
