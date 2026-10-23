package service_test

import (
	"sqldesk/internal/connection"
	"sqldesk/internal/model"
	"sqldesk/internal/service"
	"testing"
)

func TestConnectionTypesPersistAndRejectUnknown(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := service.New(repo, &stubDatabase{})
	for _, kind := range []string{"", model.TypeMySQL, model.TypeMariaDB, model.TypePolarDBMySQL, model.TypePostgreSQL, model.TypePolarDBPostgreSQL, model.TypePolarDBOracle} {
		saved, err := svc.SaveConnection(model.Connection{Type: kind, TLS: true, Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "secret"})
		if err != nil {
			t.Fatal(err)
		}
		if saved.Type != model.NormalizeDatabaseType(kind) || !saved.TLS || saved.Password != "" {
			t.Fatal("public connection lost profile or exposed secret")
		}
		loaded, err := repo.Get(saved.ID)
		if err != nil {
			t.Fatal(err)
		}
		if loaded.Type != saved.Type || !loaded.TLS || loaded.Password != "secret" {
			t.Fatal("stored connection lost type/TLS/password")
		}
	}
	if _, err := svc.SaveConnection(model.Connection{Type: "sqlserver", Name: "test", Host: "localhost", Port: 1433, Username: "user"}); err == nil {
		t.Fatal("unknown type accepted")
	}
}
