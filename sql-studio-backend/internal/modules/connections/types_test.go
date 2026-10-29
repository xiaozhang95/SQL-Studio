package connections_test

import (
	"context"
	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
	"testing"
)

func TestConnectionTypesPersistAndRejectUnknown(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := connections.New(repo, &stubDatabase{})
	for _, kind := range []string{"", model.TypeMySQL, model.TypeMariaDB, model.TypePostgreSQL} {
		saved, err := svc.SaveConnection(model.Connection{Type: kind, Database: "maintenance", TLS: true, Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "secret"})
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
		if loaded.Database != "maintenance" || loaded.Type != saved.Type || !loaded.TLS || loaded.Password != "secret" {
			t.Fatal("stored connection lost type/TLS/password")
		}
	}
	for _, kind := range []string{"polardb-mysql", "polardb-postgresql", "polardb-oracle", "sqlserver"} {
		c := model.Connection{Type: kind, Name: "test", Host: "localhost", Port: 3306, Username: "user"}
		if _, err := svc.SaveConnection(c); err == nil {
			t.Fatalf("removed type accepted: %s", kind)
		}
		if _, err := svc.TestConnection(context.Background(), c); err == nil {
			t.Fatalf("removed type tested: %s", kind)
		}
	}
}

// 收敛支持范围不能删除磁盘中的旧连接，也不能把它冒充 MySQL 返回。
func TestListConnectionsKeepsUnsupportedRecordsOnDisk(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	old, err := repo.Save(model.Connection{Type: "unsupported", Name: "old", Password: "secret"})
	if err != nil {
		t.Fatal(err)
	}
	svc := connections.New(repo, &stubDatabase{})
	if len(svc.ListConnections()) != 0 {
		t.Fatal("unsupported connection listed")
	}
	preserved, err := repo.Get(old.ID)
	if err != nil || preserved.Type != "unsupported" || preserved.Password != "secret" {
		t.Fatal("old connection modified or lost")
	}
}
