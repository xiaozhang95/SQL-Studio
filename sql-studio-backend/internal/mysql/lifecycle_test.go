package mysql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"sql-studio-backend/internal/model"
)

func TestCloseWaitsForPhysicalDriverReleaseAndKeepsOtherScopes(t *testing.T) {
	client := NewClient()
	fixtures := map[string]*queryFixture{}
	client.open = func(c model.Connection, database string) (*sql.DB, error) {
		f := &queryFixture{}
		fixtures[c.ID+database] = f
		return sql.OpenDB(fixtureConnector{f}), nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	connection := model.Connection{ID: "a"}
	a, db, releaseA, err := client.openRequest(ctx, connection, "same")
	if err != nil {
		t.Fatal(err)
	}
	if err = db.PingContext(a); err != nil {
		t.Fatal(err)
	}
	physical := fixtures["asame"]
	b, _, releaseB, err := client.openRequest(ctx, connection, "other")
	if err != nil {
		t.Fatal(err)
	}
	defer releaseB()
	other, _, releaseOther, err := client.openRequest(ctx, model.Connection{ID: "b"}, "same")
	if err != nil {
		t.Fatal(err)
	}
	defer releaseOther()
	database := "same"
	closed := make(chan error, 1)
	go func() { closed <- client.SetSession(ctx, connection, &database, false) }()
	select {
	case <-a.Done():
	case <-ctx.Done():
		t.Fatal("request was not cancelled")
	}
	select {
	case <-closed:
		t.Fatal("closed before sql.DB released")
	default:
	}
	if b.Err() != nil || other.Err() != nil {
		t.Fatal("closed another database or connection")
	}
	if _, _, _, err = client.openScopedRequest(ctx, connection, database, true); err == nil {
		t.Fatal("probe bypassed an in-progress close")
	}
	if _, _, _, err = client.openRequest(ctx, connection, database); err == nil {
		t.Fatal("closed database accepted new request")
	}
	releaseA()
	if err = <-closed; err != nil {
		t.Fatal(err)
	}
	physical.mu.Lock()
	actuallyClosed := physical.connectionClosed
	physical.mu.Unlock()
	if !actuallyClosed || db.Stats().OpenConnections != 0 {
		t.Fatal("physical driver connection still open")
	}
	if err = client.SetSession(ctx, connection, &database, true); err != nil {
		t.Fatal(err)
	}
	reopened, _, releaseReopened, err := client.openRequest(ctx, connection, database)
	if err != nil || reopened.Err() != nil {
		t.Fatal("database did not reopen", err)
	}
	releaseReopened()
	go func() { <-b.Done(); releaseB() }()
	// 请求收到取消后释放资源，关闭操作必须等待它完成。
	if err = client.SetSession(ctx, connection, nil, false); err != nil {
		t.Fatal(err)
	}
	if other.Err() != nil {
		t.Fatal("whole connection close crossed connection ID")
	}
	if _, _, _, err = client.openRequest(ctx, connection, "new"); err == nil {
		t.Fatal("closed connection accepted request")
	}
}

func TestCloseTimeoutDoesNotReportSuccess(t *testing.T) {
	client := NewClient()
	client.open = func(model.Connection, string) (*sql.DB, error) {
		return sql.OpenDB(fixtureConnector{&queryFixture{}}), nil
	}
	connection := model.Connection{ID: "fixture"}
	_, _, release, err := client.openRequest(context.Background(), connection, "db")
	if err != nil {
		t.Fatal(err)
	}
	defer release()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err = client.SetSession(ctx, connection, nil, false); !errors.Is(err, context.Canceled) {
		t.Fatal("unfinished close reported success", err)
	}
}

func TestConnectionProbeCanValidateClosedConfigurationWithoutReopening(t *testing.T) {
	client := NewClient()
	fixture := &queryFixture{columns: []string{"version"}, types: []string{"VARCHAR"}, rows: [][]driver.Value{{"fixture-version"}}}
	client.open = func(model.Connection, string) (*sql.DB, error) { return sql.OpenDB(fixtureConnector{fixture}), nil }
	ctx := context.Background()
	connection := model.Connection{ID: "closed-config"}
	if err := client.SetSession(ctx, connection, nil, false); err != nil {
		t.Fatal(err)
	}
	if version, err := client.Test(ctx, connection); err != nil || version != "fixture-version" {
		t.Fatalf("closed configuration cannot be tested: %q %v", version, err)
	}
	if _, _, _, err := client.openRequest(ctx, connection, "db"); err == nil {
		t.Fatal("probe implicitly reopened the workspace connection")
	}
	fixture.mu.Lock()
	physicalClosed := fixture.connectionClosed
	fixture.mu.Unlock()
	if !physicalClosed {
		t.Fatal("probe retained a physical connection")
	}
}
