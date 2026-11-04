package chat

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/agentstate"
	"sql-studio-backend/internal/model/agent"
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

func TestToolFailureStopsBatchAndModelContinuation(t *testing.T) {
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
				g := generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
					modelCalls++
					if modelCalls == 1 {
						return call("list_connections", `{}`), nil
					}
					if modelCalls > 2 {
						return model.Message{Role: "assistant", Content: "不应继续生成"}, nil
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
				if !errors.Is(err, failure) || !strings.Contains(err.Error(), item.tool) {
					t.Fatalf("missing terminal tool error: %v", err)
				}
				if modelCalls != 2 || db.attempts != 1 || len(started) != 2 || started[1] != item.tool {
					t.Fatalf("continued after failure: model=%d database=%d started=%v", modelCalls, db.attempts, started)
				}
				if !strings.Contains(failedResult, item.tool) || !strings.Contains(failedResult, failure.Error()) {
					t.Fatalf("missing failed tool result: %s", failedResult)
				}
				restarted := New(g, db, localstate.New(dir))
				view, err := restarted.View(ctx, id)
				if err != nil || view.Status != "error" || view.Busy {
					t.Fatalf("failure not persisted: status=%s busy=%v error=%v", view.Status, view.Busy, err)
				}
				if len(restarted.sessions[id].messages) != 1 || len(restarted.sessions[id].state.connections) != 0 {
					t.Fatal("failed turn committed model history or discovery")
				}
				if last := view.Events[len(view.Events)-1]; last.Type != "turn_end" || last.Text != "error" {
					t.Fatalf("missing error turn end: %+v", last)
				}
			})
		}
	}
}
