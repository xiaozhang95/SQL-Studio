package agent

import (
	"context"
	"encoding/json"
	"errors"
	localstate "sql-studio-backend/internal/agentstate"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

type failingToolDB struct {
	fakeDB
	err      error
	attempts int
}

func (d *failingToolDB) Databases(context.Context, string) ([]string, error) {
	d.attempts++
	return nil, d.err
}

func (d *failingToolDB) Execute(context.Context, model.Target, string, string, string) (json.RawMessage, error) {
	d.attempts++
	return nil, d.err
}

func (d *failingToolDB) Write(context.Context, model.Target, string) (json.RawMessage, error) {
	d.attempts++
	return nil, d.err
}

type discoveryFailureDB struct {
	fakeDB
	offlineAttempts int
}

func (d *discoveryFailureDB) Databases(_ context.Context, id string) ([]string, error) {
	if id == "b" {
		d.offlineAttempts++
		return nil, model.ErrReadOperation
	}
	return []string{"demo"}, nil
}

func TestDiscoverySkipsUnavailableConnectionAndKeepsBatchResults(t *testing.T) {
	ctx := context.Background()
	db := &discoveryFailureDB{}
	modelCalls := 0
	s := New(generatorFunc(func(_ context.Context, messages []model.Message, _ []model.Tool) (model.Message, error) {
		modelCalls++
		switch modelCalls {
		case 1:
			return call("list_connections", "{}"), nil
		case 2:
			batch := call("list_databases", `{"connectionId":"b"}`)
			online := call("list_databases", `{"connectionId":"a"}`).ToolCalls[0]
			online.ID = "online"
			batch.ToolCalls = append(batch.ToolCalls, online)
			return batch, nil
		case 3:
			var warning map[string]string
			if err := json.Unmarshal([]byte(messages[len(messages)-3].Content), &warning); err != nil || warning["connectionId"] != "b" || warning["warning"] == "" {
				t.Fatalf("model did not receive a warning for the unavailable connection: %v (%v)", warning, err)
			}
			online := messages[len(messages)-2]
			if online.ToolCallID != "online" || online.Content != `["demo"]` {
				t.Fatalf("model did not receive the successful result in the same batch: %+v", online)
			}
			return call("list_databases", `{"connectionId":"b"}`), nil
		default:
			return model.Message{Role: "assistant", Content: "已找到 demo，备用连接未能检查"}, nil
		}
	}), db)
	id, err := s.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	err = s.Chat(ctx, id, "查找 demo", func(event model.Event) error {
		if event.Type == continueConfirmation {
			t.Fatal("connection discovery should not require approval")
		}
		return nil
	})
	if err != nil || modelCalls != 4 || db.offlineAttempts != 1 {
		t.Fatalf("model calls=%d offline attempts=%d error=%v", modelCalls, db.offlineAttempts, err)
	}
}

func TestToolFailureStopsBatchAndReturnsToModel(t *testing.T) {
	for _, mode := range []string{"readonly", "write"} {
		for _, item := range []struct{ tool, args string }{
			{"list_databases", `{"connectionId":"a"}`},
			{"list_tables", `{}`},
			{"query_readonly", `{"sql":"SELECT 1"}`},
			{"execute_write", `{"sql":"UPDATE orders SET id=1 WHERE id=2"}`},
		} {
			if mode == "readonly" && item.tool == "execute_write" {
				continue
			}
			t.Run(mode+"/"+item.tool, func(t *testing.T) {
				ctx := context.Background()
				failure := errors.New("测试数据库操作失败")
				db := &failingToolDB{err: failure}
				modelCalls := 0
				g := generatorFunc(func(_ context.Context, messages []model.Message, definitions []model.Tool) (model.Message, error) {
					modelCalls++
					if modelCalls == 1 {
						return call("list_connections", `{}`), nil
					}
					if modelCalls > 2 {
						if (len(definitions) == 0) != (item.tool == "execute_write") {
							t.Fatalf("unexpected recovery tools: %v", definitions)
						}
						for _, definition := range definitions {
							if definition.Function.Name == "execute_write" {
								t.Fatal("write tool exposed during recovery")
							}
						}
						if warning := messages[len(messages)-5]; warning.Role != "tool" || !strings.Contains(warning.Content, failure.Error()) {
							t.Fatalf("model did not receive failure: %+v", warning)
						}
						for _, skipped := range messages[len(messages)-4 : len(messages)-1] {
							if skipped.Role != "tool" || !strings.Contains(skipped.Content, "skipped") {
								t.Fatalf("missing skipped tool result: %+v", skipped)
							}
						}
						return model.Message{Role: "assistant", Content: "部分操作未能完成"}, nil
					}
					batch := call(item.tool, item.args)
					batch.ToolCalls = append(batch.ToolCalls,
						call("list_databases", `{"connectionId":"b"}`).ToolCalls[0],
						call("query_readonly", `{"sql":"SELECT 2"}`).ToolCalls[0],
						call("execute_write", `{"sql":"UPDATE orders SET id=2 WHERE id=1"}`).ToolCalls[0])
					return batch, nil
				})
				dir := t.TempDir()
				s := New(g, db, localstate.New(dir))
				id, err := s.Create(ctx)
				if err != nil {
					t.Fatal(err)
				}
				s.sessions[id].state.target = model.Target{ConnectionID: "a", Database: "demo"}
				var started []string
				var failedResult string
				err = s.ChatMode(ctx, id, "检查数据库", mode, func(e model.Event) error {
					if e.Type == "tool_start" {
						started = append(started, e.Tool)
					}
					if e.Type == continueConfirmation {
						t.Fatal("tool failure should return to the model without approval")
					}
					if e.Type == "write_confirmation" {
						var approval struct {
							ID string `json:"approvalId"`
						}
						if err := json.Unmarshal(e.Result, &approval); err != nil {
							return err
						}
						return s.ConfirmWrite(approval.ID, true)
					}
					if e.Type == "tool_result" && e.Tool == item.tool {
						failedResult = string(e.Result)
					}
					return nil
				})
				if err != nil {
					t.Fatalf("failed to complete the response: %v", err)
				}
				if modelCalls != 3 || db.attempts != 1 || len(started) != 2 || started[1] != item.tool {
					t.Fatalf("continued after failure: model=%d database=%d started=%v", modelCalls, db.attempts, started)
				}
				if !strings.Contains(failedResult, item.tool) || !strings.Contains(failedResult, failure.Error()) {
					t.Fatalf("missing failed tool result: %s", failedResult)
				}
				restarted := New(g, db, localstate.New(dir))
				view, err := restarted.View(ctx, id)
				if err != nil || view.Status != "completed" || view.Busy {
					t.Fatalf("failure not persisted: status=%s busy=%v error=%v", view.Status, view.Busy, err)
				}
				if last := view.Events[len(view.Events)-1]; last.Type != "turn_end" || last.Text != "completed" {
					t.Fatalf("missing completed turn end: %+v", last)
				}
			})
		}
	}
}
