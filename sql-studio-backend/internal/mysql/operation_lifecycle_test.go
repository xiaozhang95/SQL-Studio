package mysql

import (
	"context"
	"database/sql"
	"errors"
	"sql-studio-backend/internal/model"
	"testing"
)

func TestIndependentClientsReleaseEachOperationWithoutChangingWorkspace(t *testing.T) {
	operations := []struct {
		name string
		run  func(context.Context, *Client, model.Connection) error
	}{
		{"databases", func(ctx context.Context, c *Client, conn model.Connection) error {
			_, err := c.Databases(ctx, conn)
			return err
		}},
		{"tables", func(ctx context.Context, c *Client, conn model.Connection) error {
			_, err := c.Tables(ctx, conn, "demo")
			return err
		}},
		{"columns", func(ctx context.Context, c *Client, conn model.Connection) error {
			_, err := c.Columns(ctx, conn, model.TableRef{Database: "demo", Name: "orders"})
			return err
		}},
		{"read", func(ctx context.Context, c *Client, conn model.Connection) error {
			_, err := c.Execute(ctx, conn, model.QueryRequest{Database: "demo", SQL: "SELECT 1", Limit: 100})
			return err
		}},
		{"write", func(ctx context.Context, c *Client, conn model.Connection) error {
			_, err := c.Execute(ctx, conn, model.QueryRequest{Database: "demo", SQL: "UPDATE orders SET id=1", AllowWrite: true})
			return err
		}},
	}
	for _, operation := range operations {
		for _, outcome := range []string{"success", "query-error", "cancelled"} {
			if operation.name == "write" && outcome == "query-error" {
				continue
			}
			t.Run(operation.name+"/"+outcome, func(t *testing.T) {
				connection := model.Connection{ID: "same-connection"}
				workspace, agent := NewClient(), NewClient()
				workspaceFixture := &queryFixture{}
				workspace.open = func(model.Connection, string) (*sql.DB, error) {
					return sql.OpenDB(fixtureConnector{workspaceFixture}), nil
				}
				workspaceCtx, workspaceDB, releaseWorkspace, err := workspace.openRequest(context.Background(), connection, "demo")
				if err != nil {
					t.Fatal(err)
				}
				defer releaseWorkspace()
				if err := workspaceDB.PingContext(workspaceCtx); err != nil {
					t.Fatal(err)
				}

				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				fixture := &queryFixture{columns: []string{"value"}, types: []string{"TEXT"}}
				if outcome == "query-error" {
					fixture.queryError = errors.New("fixture query failed")
				}
				var agentDB *sql.DB
				agent.open = func(model.Connection, string) (*sql.DB, error) {
					agentDB = sql.OpenDB(fixtureConnector{fixture})
					if err := agentDB.PingContext(context.Background()); err != nil {
						return agentDB, err
					}
					if outcome == "cancelled" {
						cancel()
					}
					return agentDB, nil
				}
				err = operation.run(ctx, agent, connection)
				if (outcome == "success") != (err == nil) {
					t.Fatalf("unexpected operation result: %v", err)
				}
				if outcome == "cancelled" && !errors.Is(err, context.Canceled) {
					t.Fatal("cancellation lost", err)
				}
				fixture.mu.Lock()
				closed := fixture.connectionClosed
				fixture.mu.Unlock()
				if agentDB == nil || !closed || agentDB.Stats().OpenConnections != 0 || len(agent.active) != 0 {
					t.Fatal("Agent operation retained a physical connection or active lease")
				}
				workspaceFixture.mu.Lock()
				workspaceClosed := workspaceFixture.connectionClosed
				workspaceFixture.mu.Unlock()
				if workspaceCtx.Err() != nil || workspaceClosed || workspaceDB.Stats().OpenConnections != 1 {
					t.Fatal("Agent operation changed the workspace connection")
				}

				releaseWorkspace()
				if err := workspace.SetSession(context.Background(), connection, nil, false); err != nil {
					t.Fatal(err)
				}
				agent.open = func(model.Connection, string) (*sql.DB, error) {
					return sql.OpenDB(fixtureConnector{&queryFixture{columns: []string{"name"}, types: []string{"TEXT"}}}), nil
				}
				if _, err := agent.Databases(context.Background(), connection); err != nil {
					t.Fatal("workspace close blocked independent Agent operation", err)
				}
				if _, _, release, err := workspace.openRequest(context.Background(), connection, "demo"); err == nil {
					release()
					t.Fatal("Agent operation reopened workspace connection")
				}
			})
		}
	}
}
