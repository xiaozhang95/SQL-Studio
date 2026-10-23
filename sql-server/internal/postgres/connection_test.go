package postgres

import (
	"sqldesk/internal/model"
	"testing"
)

func TestPolarDBPostgresAndOracleConfiguration(t *testing.T) {
	for _, kind := range []string{model.TypePostgreSQL, model.TypePolarDBPostgreSQL, model.TypePolarDBOracle} {
		c := model.Connection{Type: kind, Host: "db.example", Port: 5432, Username: "user@domain", Password: "p@ss:/?#word", Database: "sample", TLS: true}
		cfg, err := driverConfig(c, "", `schema"name`)
		if err != nil {
			t.Fatal(err)
		}
		if cfg.Host != c.Host || cfg.User != c.Username || cfg.Password != c.Password || cfg.Database != "sample" || cfg.TLSConfig == nil || cfg.TLSConfig.InsecureSkipVerify || cfg.TLSConfig.ServerName != c.Host {
			t.Fatal("PostgreSQL profile lost connection/TLS settings")
		}
		if cfg.RuntimeParams["search_path"] != `"schema""name"` {
			t.Fatal("schema identifier not escaped")
		}
	}
	if quoteIdentifier(`table"name`) != `"table""name"` {
		t.Fatal("table identifier not escaped")
	}
	if _, err := driverConfig(model.Connection{Type: model.TypeMySQL}, "", ""); err == nil {
		t.Fatal("wrong protocol accepted")
	}
	cfg, err := driverConfig(model.Connection{Type: model.TypePostgreSQL, Host: "127.0.0.1", Port: 5432, Username: "postgres"}, "", "")
	if err != nil || cfg.Database != "postgres" || cfg.TLSConfig != nil {
		t.Fatal("default PostgreSQL config changed")
	}
}
