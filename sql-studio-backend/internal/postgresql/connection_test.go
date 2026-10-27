package postgresql

import (
	"github.com/jackc/pgx/v5"
	"sql-studio-backend/internal/model"
	"testing"
)

func TestDriverConfiguration(t *testing.T) {
	connection := model.Connection{Type: model.TypePostgreSQL, Host: "localhost", Port: 5432, Username: "test user", Password: "a@b:/?secret", Database: "maintenance"}
	cfg, err := driverConfig(connection, "")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Database != "maintenance" || cfg.Password != connection.Password || cfg.User != connection.Username || cfg.TLSConfig != nil || cfg.DefaultQueryExecMode != pgx.QueryExecModeExec {
		t.Fatal("connection configuration changed")
	}
	connection.TLS = true
	cfg, err = driverConfig(connection, "selected")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Database != "selected" || cfg.TLSConfig == nil || cfg.TLSConfig.InsecureSkipVerify || cfg.TLSConfig.ServerName != "localhost" || len(cfg.Fallbacks) != 0 {
		t.Fatal("TLS must verify server without plaintext fallback")
	}
	connection.Type = model.TypeMySQL
	if _, err = driverConfig(connection, ""); err == nil {
		t.Fatal("cross-engine configuration accepted")
	}
}
func TestSchemaQualifiedIdentity(t *testing.T) {
	for _, value := range []struct{ input, schema, table string }{{`"a.b"."t""x"`, "a.b", `t"x`}, {`"other"."t"`, "other", "t"}, {"t", "public", "t"}} {
		schema, table, err := relation(value.input)
		if err != nil || schema != value.schema || table != value.table {
			t.Fatalf("identity lost for %q", value.input)
		}
	}
	for _, value := range []string{`"bad`, `"a"."b";DROP TABLE x`, `"a"`, ""} {
		if _, _, err := relation(value); err == nil {
			t.Fatalf("invalid identity accepted: %q", value)
		}
	}
}
