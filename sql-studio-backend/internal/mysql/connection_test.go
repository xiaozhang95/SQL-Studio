package mysql

import (
	"sql-studio-backend/internal/model"
	"testing"
)

func TestCompatibleProfilesAndTLS(t *testing.T) {
	for _, kind := range []string{"", model.TypeMySQL} {
		cfg, err := driverConfig(model.Connection{Type: kind, Host: "database.example", Port: 3306, Username: "user", Password: "secret", TLS: true}, "example")
		if err != nil {
			t.Fatal(err)
		}
		if cfg.TLSConfig != "true" || cfg.MultiStatements || cfg.DBName != "example" || cfg.Addr != "database.example:3306" {
			t.Fatal("compatible profile changed driver settings")
		}
	}
	if _, err := driverConfig(model.Connection{Type: "postgresql"}, ""); err == nil {
		t.Fatal("unsupported protocol accepted")
	}
	cfg, err := driverConfig(model.Connection{Host: "127.0.0.1", Port: 3306}, "")
	if err != nil || cfg.TLSConfig != "" {
		t.Fatal("legacy TLS default changed")
	}
}
