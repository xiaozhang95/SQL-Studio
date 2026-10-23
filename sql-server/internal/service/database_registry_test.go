package service_test

import (
	"context"
	"sqldesk/internal/model"
	"sqldesk/internal/service"
	"testing"
)

func TestDatabaseRegistryRoutesByProtocol(t *testing.T) {
	mysql := &stubDatabase{test: func(context.Context, model.Connection) (string, error) { return "mysql", nil }}
	postgres := &stubDatabase{test: func(context.Context, model.Connection) (string, error) { return "postgres", nil }}
	registry := service.NewDatabaseRegistry(mysql, postgres)
	for _, kind := range []string{"", model.TypeMySQL, model.TypeMariaDB, model.TypePolarDBMySQL, model.TypePostgreSQL, model.TypePolarDBPostgreSQL, model.TypePolarDBOracle} {
		version, err := registry.Test(context.Background(), model.Connection{Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		expected := "mysql"
		if model.IsPostgres(kind) {
			expected = "postgres"
		}
		if version != expected {
			t.Fatalf("%s routed to wrong driver", kind)
		}
	}
}
