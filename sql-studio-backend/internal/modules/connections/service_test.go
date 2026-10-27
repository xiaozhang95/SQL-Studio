package connections_test

import (
	"context"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
)

type stubDatabase struct {
	test func(context.Context, model.Connection) (string, error)
}

func (d *stubDatabase) Test(ctx context.Context, c model.Connection) (string, error) {
	return d.test(ctx, c)
}

func (d *stubDatabase) SetSession(context.Context, model.Connection, *string, bool) error { return nil }

func TestConnectionPolicies(t *testing.T) {
	repo, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	driver := &stubDatabase{test: func(ctx context.Context, c model.Connection) (string, error) {
		if c.Password != "saved-secret" {
			t.Fatal("stored password was not resolved")
		}
		deadline, ok := ctx.Deadline()
		if !ok || time.Until(deadline) > 7*time.Second {
			t.Fatal("connection timeout missing")
		}
		return "test", nil
	}}
	svc := connections.New(repo, driver)
	saved, err := svc.SaveConnection(model.Connection{Name: "test", Host: "localhost", Port: 3306, Username: "root", Password: "saved-secret"})
	if err != nil {
		t.Fatal(err)
	}
	if saved.Password != "" {
		t.Fatal("saved response leaked password")
	}
	if _, err = svc.SaveConnection(model.Connection{Name: "invalid"}); err == nil {
		t.Fatal("invalid connection accepted")
	}
	if _, err = svc.TestConnection(context.Background(), saved); err != nil {
		t.Fatal(err)
	}
}
