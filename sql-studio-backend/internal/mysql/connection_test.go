package mysql

import (
	"sql-studio-backend/internal/model"
	"testing"
)

func TestCompatibleProfilesAndTLS(t *testing.T) {
	for _, kind := range []string{"", model.TypeMySQL, model.TypeMariaDB} {
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

func TestMatchedRowsIsOptInPerConnection(t *testing.T) {
	connection := model.Connection{Type: model.TypeMySQL, Host: "localhost", Port: 3306}
	ordinary, err := driverConfig(connection, "example")
	if err != nil {
		t.Fatal(err)
	}
	matched, err := driverConfig(connection, "example", true)
	if err != nil {
		t.Fatal(err)
	}
	if ordinary.ClientFoundRows || !matched.ClientFoundRows || matched.MultiStatements {
		t.Fatal("matched row opt-in changed ordinary SQL semantics")
	}
}
