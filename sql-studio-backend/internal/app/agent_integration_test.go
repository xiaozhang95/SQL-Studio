package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/database"
	"sql-studio-backend/internal/mariadb"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
	agent "sql-studio-backend/internal/modules/agent"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
	"sql-studio-backend/internal/mysql"
	"sql-studio-backend/internal/postgresql"
)

type archiveGenerator func(context.Context, []agentmodel.Message, []agentmodel.Tool) (agentmodel.Message, error)

func (g archiveGenerator) Generate(ctx context.Context, messages []agentmodel.Message, tools []agentmodel.Tool) (agentmodel.Message, error) {
	return g(ctx, messages, tools)
}

// Explicitly opt in with a disposable database server. No production connection
// state or real model credentials are read by this test.
func TestAgentRealDatabaseIntegration(t *testing.T) {
	if os.Getenv("SQLDESK_AGENT_INTEGRATION") != "1" {
		t.Skip("set SQLDESK_AGENT_INTEGRATION=1, SQLDESK_AGENT_PASSWORD and engine-specific PORT variables for disposable servers")
	}
	defaultPassword := os.Getenv("SQLDESK_AGENT_PASSWORD")
	for _, engine := range []string{model.TypeMySQL, model.TypePostgreSQL, model.TypeMariaDB} {
		t.Run(engine, func(t *testing.T) {
			prefix := "SQLDESK_AGENT_" + strings.ToUpper(engine)
			password := os.Getenv(prefix + "_PASSWORD")
			if password == "" {
				password = defaultPassword
			}
			if password == "" {
				t.Fatal("explicit disposable server password is required")
			}
			port, err := strconv.Atoi(os.Getenv(prefix + "_PORT"))
			if err != nil || port < 1 || port > 65535 {
				t.Fatal("explicit disposable server port is required")
			}
			ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
			defer cancel()
			repo, err := connection.Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			client := database.New(map[string]database.Engine{model.TypeMySQL: mysql.NewClient(), model.TypePostgreSQL: postgresql.NewClient(), model.TypeMariaDB: mariadb.NewClient()})
			cs := connections.New(repo, client)
			username, maintenance := "root", ""
			if engine == model.TypePostgreSQL {
				username, maintenance = "postgres", "postgres"
			}
			c, err := cs.SaveConnection(model.Connection{Name: "Agent regression", Type: engine, Host: "127.0.0.1", Port: port, Username: username, Password: password, Database: maintenance})
			if err != nil {
				t.Fatal(err)
			}
			private, _ := repo.Get(c.ID)
			name := fmt.Sprintf("agent_review_%x", time.Now().UnixNano())
			identifier := "`" + name + "`"
			if engine == model.TypePostgreSQL {
				identifier = `"` + name + `"`
			}
			targetDatabase, createSQL, cleanupSQL := name, "CREATE DATABASE "+identifier, "DROP DATABASE "+identifier
			qualify := func(sql string) string { return sql }
			if engine == model.TypePostgreSQL {
				targetDatabase, createSQL, cleanupSQL = maintenance, "CREATE SCHEMA "+identifier, "DROP SCHEMA "+identifier+" CASCADE"
				qualify = func(sql string) string { return strings.ReplaceAll(sql, "items", identifier+`."items"`) }
			}
			if _, err = client.Execute(ctx, private, model.QueryRequest{Database: maintenance, SQL: createSQL, AllowWrite: true}); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				cleanup, stop := context.WithTimeout(context.Background(), 10*time.Second)
				defer stop()
				if _, err := client.Execute(cleanup, private, model.QueryRequest{Database: maintenance, SQL: cleanupSQL, AllowWrite: true}); err != nil {
					t.Errorf("cleanup disposable database: %v", err)
				}
			})
			agentClient := newDatabaseClient()
			adapter := agentDatabase{cs, metadata.New(repo, agentClient), query.New(repo, client).WithExecutor(agentClient)}
			target := agentmodel.Target{ConnectionID: c.ID, Database: targetDatabase}
			run := func(sql string) model.QueryResult {
				t.Helper()
				out, err := client.Execute(ctx, private, model.QueryRequest{Database: targetDatabase, SQL: qualify(sql), AllowWrite: true, Limit: 1000})
				if err != nil {
					t.Fatal(err)
				}
				return out
			}
			run("CREATE TABLE items (id BIGINT PRIMARY KEY, amount DECIMAL(20,4), label VARCHAR(100))")
			rows := []string{"(9007199254740993,9999999999999999.1234,NULL)"}
			for i := 1; i <= 140; i++ {
				rows = append(rows, fmt.Sprintf("(%d,12.3400,'fixture')", i))
			}
			run("INSERT INTO items VALUES " + strings.Join(rows, ","))
			data, err := adapter.Execute(ctx, target, "query_readonly", "", qualify("SELECT id,amount,label,id AS id FROM items WHERE id=9007199254740993"))
			var result model.QueryResult
			if err != nil || json.Unmarshal(data, &result) != nil || len(result.Rows) != 1 || result.Rows[0][0] != "9007199254740993" || result.Rows[0][1] != "9999999999999999.1234" || result.Rows[0][2] != nil || len(result.Columns) != 4 {
				t.Fatal("precision/NULL/duplicate-column contract failed", err)
			}
			data, err = adapter.Execute(ctx, target, "query_readonly", "", qualify("SELECT id FROM items ORDER BY id"))
			if err != nil || json.Unmarshal(data, &result) != nil || !result.Truncated || len(result.Rows) != 100 {
				t.Fatal("Agent 100-row preview limit failed", err)
			}
			for _, sql := range []string{"SELECT cleanup_fixture()", "SELECT pg_sleep(1)", "DELETE FROM items", "SELECT 1; SELECT 2"} {
				if _, err := adapter.Execute(ctx, target, "query_readonly", "", qualify(sql)); err == nil {
					t.Fatal("unsafe read allowed", sql)
				}
			}
			for _, sql := range []string{"DELETE FROM items", "INSERT INTO items SELECT lo_unlink(42),1,'x'"} {
				if _, err := adapter.Write(ctx, target, qualify(sql)); err == nil {
					t.Fatal("unsafe write allowed", sql)
				}
			}
			for _, decision := range []string{"readonly", "reject", "disconnect", "approve-then-cancel", "approve", "update", "deny-delete"} {
				step := 0
				tool := func(name string, arguments any) agentmodel.Message {
					encoded, _ := json.Marshal(arguments)
					return agentmodel.Message{Role: "assistant", ToolCalls: []agentmodel.ToolCall{{ID: fmt.Sprint(step), Type: "function", Function: agentmodel.Function{Name: name, Arguments: string(encoded)}}}}
				}
				mode, sql := "write", "INSERT INTO items VALUES (800,1,'confirmed')"
				switch decision {
				case "readonly":
					mode = "readonly"
				case "update":
					sql = "UPDATE items SET amount=amount+1 WHERE id=800"
				case "deny-delete":
					sql = "DELETE FROM items WHERE id=800"
				}
				var service *agent.Service
				service = agent.New(archiveGenerator(func(context.Context, []agentmodel.Message, []agentmodel.Tool) (agentmodel.Message, error) {
					step++
					switch step {
					case 1:
						return tool("list_connections", struct{}{}), nil
					case 2:
						return tool("list_databases", map[string]string{"connectionId": c.ID}), nil
					case 3:
						return tool("use_database", target), nil
					case 4:
						return tool("execute_write", map[string]string{"sql": qualify(sql)}), nil
					default:
						return agentmodel.Message{Role: "assistant", Content: "完成"}, nil
					}
				}), adapter)
				id, _ := service.Create(ctx)
				approval := ""
				turn, stop := context.WithCancel(ctx)
				err := service.ChatMode(turn, id, "fixture", mode, func(event agentmodel.Event) error {
					if event.Type == "write_confirmation" {
						before := run("SELECT amount FROM items WHERE id=800").Rows
						if decision == "update" {
							if len(before) != 1 || before[0][0] != "1.0000" {
								t.Fatal("update executed before confirmation")
							}
						} else if len(before) != 0 {
							t.Fatal("insert executed before confirmation")
						}
						var details struct {
							ApprovalID string `json:"approvalId"`
						}
						if err := json.Unmarshal(event.Result, &details); err != nil {
							return err
						}
						approval = details.ApprovalID
						if decision == "disconnect" {
							stop()
							return context.Canceled
						}
						if err := service.ConfirmContinue(approval, true); err == nil {
							return errors.New("write confirmation accepted by continue endpoint")
						}
						if decision == "approve-then-cancel" {
							if err := service.ConfirmWrite(approval, true); err != nil {
								return err
							}
							stop()
							return nil
						}
						const clients = 24
						start := make(chan struct{})
						results := make(chan error, clients)
						allow := decision == "approve" || decision == "update"
						for range clients {
							go func() {
								<-start
								results <- service.ConfirmWrite(approval, allow)
							}()
						}
						close(start)
						successes := 0
						for range clients {
							if <-results == nil {
								successes++
							}
						}
						if successes != 1 {
							return fmt.Errorf("%d concurrent confirmations accepted, want 1", successes)
						}
					}
					return nil
				})
				stop()
				expectApproval := decision != "readonly" && decision != "deny-delete"
				if (approval != "") != expectApproval || (approval != "" && service.ConfirmWrite(approval, true) == nil) {
					t.Fatalf("%s: confirmation or replay contract failed", decision)
				}
				switch decision {
				case "reject":
					if err == nil {
						t.Fatal("rejected write did not stop")
					}
				case "disconnect", "approve-then-cancel":
					if !errors.Is(err, context.Canceled) {
						t.Fatalf("%s: %v", decision, err)
					}
				default:
					if err != nil {
						t.Fatalf("%s: %v", decision, err)
					}
				}
				got := run("SELECT amount FROM items WHERE id=800").Rows
				switch decision {
				case "approve":
					if len(got) != 1 || got[0][0] != "1.0000" {
						t.Fatal("confirmed insert was not applied")
					}
				case "update", "deny-delete":
					if len(got) != 1 || got[0][0] != "2.0000" {
						t.Fatal("confirmed update or deletion guard failed")
					}
				default:
					if len(got) != 0 {
						t.Fatal("unconfirmed write was applied")
					}
				}
			}
			// The normal SQL executor retains its independent write capability.
			run("DELETE FROM items WHERE id=800")
			if run("SELECT COUNT(*) FROM items WHERE id=800").Rows[0][0] != "0" {
				t.Fatal("ordinary SQL window was restricted")
			}
			t.Log("real precision, NULL, duplicate columns, preview truncation, unsafe-query rejection, 24 concurrent confirmations, cancellation, replay and normal SQL write verified")
		})
	}
}
