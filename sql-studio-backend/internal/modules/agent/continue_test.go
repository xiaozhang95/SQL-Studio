package chat

import (
	"context"
	"encoding/json"
	"errors"
	"sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
	"time"
)

func continueID(t *testing.T, event model.Event, kind string) string {
	t.Helper()
	var request struct {
		ID   string `json:"approvalId"`
		Kind string `json:"kind"`
	}
	if err := json.Unmarshal(event.Result, &request); err != nil || request.ID == "" || request.Kind != kind {
		t.Fatalf("invalid %s approval: %s", kind, event.Result)
	}
	return request.ID
}

func TestContinuationPausesExecutionBudget(t *testing.T) {
	ctx, stop := newTurnBudget(context.Background(), time.Minute)
	defer stop()
	budget := ctx.Value(turnBudgetKey{}).(*turnBudget)
	s := New(nil, &fakeDB{})
	err := s.approveContinue(ctx, "input", "等待", func(event model.Event) error {
		budget.mu.Lock()
		paused := budget.started.IsZero()
		budget.mu.Unlock()
		if !paused {
			t.Fatal("execution clock kept running while awaiting consent")
		}
		return s.ConfirmContinue(continueID(t, event, "input"), true)
	})
	budget.mu.Lock()
	running := !budget.started.IsZero() && budget.remaining > 0
	budget.mu.Unlock()
	if err != nil || !running {
		t.Fatal("execution clock was not restored", err)
	}
}

func TestLongInputWaitsForMatchingConsent(t *testing.T) {
	ctx := context.Background()
	for _, tc := range []struct {
		name  string
		size  int
		allow bool
		calls int
	}{
		{"normal", model.MessageNoticeBytes, true, 1},
		{"allowed", model.MessageMaxBytes, true, 1},
		{"declined", model.MessageNoticeBytes + 1, false, 0},
		{"over limit", model.MessageMaxBytes + 1, true, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			text := strings.Repeat("x", tc.size)
			calls, approvals := 0, 0
			s := New(generatorFunc(func(_ context.Context, messages []model.Message, _ []model.Tool) (model.Message, error) {
				calls++
				if messages[len(messages)-2].Content != text {
					t.Fatal("model did not receive the original input")
				}
				return model.Message{Role: "assistant", Content: "完成"}, nil
			}), &fakeDB{})
			id, _ := s.Create(ctx)
			err := s.Chat(ctx, id, text, func(event model.Event) error {
				if event.Type != continueConfirmation {
					return nil
				}
				approvals++
				if calls != 0 {
					t.Fatal("model called before consent")
				}
				token := continueID(t, event, "input")
				if s.ConfirmWrite(token, true) == nil {
					t.Fatal("write endpoint accepted continuation token")
				}
				if err := s.ConfirmContinue(token, tc.allow); err != nil {
					t.Fatal(err)
				}
				if s.ConfirmContinue(token, true) == nil {
					t.Fatal("continuation token reused")
				}
				return nil
			})
			wantApproval := tc.size > model.MessageNoticeBytes && tc.size <= model.MessageMaxBytes
			if (approvals == 1) != wantApproval || calls != tc.calls || (err == nil) != (tc.calls > 0) {
				t.Fatalf("model calls=%d approvals=%d error=%v", calls, approvals, err)
			}
		})
	}
}

type resultSizeDB struct {
	fakeDB
	result json.RawMessage
}

func (d *resultSizeDB) Execute(context.Context, model.Target, string, string, string) (json.RawMessage, error) {
	d.calls++
	return d.result, nil
}

func TestLargeResultConsentUsesOriginalResult(t *testing.T) {
	for _, allow := range []bool{true, false} {
		ctx := context.Background()
		data, _ := json.Marshal([]string{strings.Repeat("x", model.ToolNoticeBytes)})
		db := &resultSizeDB{result: data}
		calls := 0
		s := New(generatorFunc(func(_ context.Context, messages []model.Message, _ []model.Tool) (model.Message, error) {
			calls++
			if calls == 1 {
				return call("query_readonly", `{"sql":"SELECT 1"}`), nil
			}
			if messages[len(messages)-2].Content != string(data) {
				t.Fatal("original result was not sent")
			}
			return model.Message{Role: "assistant", Content: "完成"}, nil
		}), db)
		id, _ := s.Create(ctx)
		s.sessions[id].state.target = model.Target{ConnectionID: "a", Database: "demo"}
		err := s.Chat(ctx, id, "分析", func(event model.Event) error {
			if event.Type == continueConfirmation {
				if db.calls != 1 || calls != 1 {
					t.Fatal("unexpected activity before result confirmation")
				}
				return s.ConfirmContinue(continueID(t, event, "result"), allow)
			}
			return nil
		})
		if db.calls != 1 || (allow && (err != nil || calls != 2)) || (!allow && (!errors.Is(err, model.ErrContinueCancelled) || calls != 1)) {
			t.Fatalf("allow=%v reads=%d model calls=%d error=%v", allow, db.calls, calls, err)
		}
	}
}

func TestSQLPolicyRejectionReturnsPriorResultsToModel(t *testing.T) {
	ctx := context.Background()
	db := &fakeDB{}
	calls := 0
	s := New(generatorFunc(func(_ context.Context, messages []model.Message, _ []model.Tool) (model.Message, error) {
		calls++
		if calls == 1 {
			batch := call("list_tables", "{}")
			query := call("query_readonly", `{"sql":"SELECT table_name FROM information_schema.tables"}`).ToolCalls[0]
			query.ID = "metadata"
			batch.ToolCalls = append(batch.ToolCalls, query)
			return batch, nil
		}
		previous, rejected := messages[len(messages)-3], messages[len(messages)-2]
		if !strings.Contains(previous.Content, "9007199254740993") || rejected.ToolCallID != "metadata" || !strings.Contains(rejected.Content, errAgentSQL.Error()) {
			t.Fatalf("model did not receive the prior result and the policy rejection: %+v, %+v", previous, rejected)
		}
		return model.Message{Role: "assistant", Content: "已列出表，补充元数据无法读取"}, nil
	}), db)
	id, err := s.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	s.sessions[id].state.target = model.Target{ConnectionID: "a", Database: "demo"}
	err = s.Chat(ctx, id, "检查 MySQL 数据库", func(event model.Event) error {
		if event.Type == continueConfirmation {
			t.Fatal("a rejected query should be handled by the model")
		}
		return nil
	})
	if err != nil || calls != 2 || db.calls != 1 {
		t.Fatalf("database calls=%d model calls=%d error=%v", db.calls, calls, err)
	}
}

func TestReadRecoverySkipsRemainingBatch(t *testing.T) {
	for _, failure := range []error{model.ErrReadOperation, model.ErrToolResultTooLarge} {
		ctx := context.Background()
		db := &failingToolDB{err: failure}
		calls := 0
		s := New(generatorFunc(func(_ context.Context, messages []model.Message, definitions []model.Tool) (model.Message, error) {
			calls++
			if calls == 1 {
				batch := call("query_readonly", `{"sql":"SELECT 1"}`)
				skipped := call("query_readonly", `{"sql":"SELECT 2"}`).ToolCalls[0]
				skipped.ID = "skipped"
				batch.ToolCalls = append(batch.ToolCalls, skipped)
				return batch, nil
			}
			if calls == 2 {
				skipped := messages[len(messages)-2]
				if skipped.ToolCallID != "skipped" || !strings.Contains(skipped.Content, "skipped") {
					t.Fatal("skipped tool result pair missing")
				}
				return call("query_readonly", `{"sql":"SELECT 3"}`), nil
			}
			if len(definitions) != 0 || !strings.Contains(messages[len(messages)-2].Content, failure.Error()) {
				t.Fatal("repeated failure should be sent back for a tool-free summary")
			}
			return model.Message{Role: "assistant", Content: "说明部分失败"}, nil
		}), db)
		id, _ := s.Create(ctx)
		s.sessions[id].state.target = model.Target{ConnectionID: "a", Database: "demo"}
		err := s.Chat(ctx, id, "查询", func(event model.Event) error {
			if event.Type == continueConfirmation {
				t.Fatal("tool failure should not require approval")
			}
			return nil
		})
		if err != nil || calls != 3 || db.attempts != 2 {
			t.Fatalf("failure=%v attempts=%d calls=%d error=%v", failure, db.attempts, calls, err)
		}
	}
}
