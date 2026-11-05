package agent

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	localstate "sql-studio-backend/internal/agentstate"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestCapacityRejectionDoesNotChangeConversation(t *testing.T) {
	s := New(nil, &fakeDB{})
	id, _ := s.Create(context.Background())
	s.slots <- struct{}{}
	s.slots <- struct{}{}
	if err := s.Chat(context.Background(), id, "不能落盘的提问", func(model.Event) error { return nil }); err == nil {
		t.Fatal("capacity accepted")
	}
	v, _ := s.View(context.Background(), id)
	if v.Busy || len(v.Events) != 0 || v.Status != "idle" || v.Title != "新建会话" {
		t.Fatal("rejected turn changed state", v)
	}
}

func TestPendingConfirmationsReleaseCapacity(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	s := New(generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
		return model.Message{Role: "assistant", Content: "完成"}, nil
	}), &fakeDB{})
	tokens := make(chan string, 2)
	done := make(chan error, 2)
	for range 2 {
		id, _ := s.Create(ctx)
		go func() {
			done <- s.Chat(ctx, id, strings.Repeat("x", model.MessageNoticeBytes+1), func(e model.Event) error {
				if e.Type == continueConfirmation {
					var v struct {
						ID string `json:"approvalId"`
					}
					if err := json.Unmarshal(e.Result, &v); err != nil {
						return err
					}
					tokens <- v.ID
				}
				return nil
			})
		}()
	}
	ids := []string{<-tokens, <-tokens}
	id, _ := s.Create(ctx)
	if err := s.Chat(ctx, id, "第三个会话", func(model.Event) error { return nil }); err != nil {
		t.Fatal("pending consent exhausted capacity", err)
	}
	for _, id := range ids {
		if err := s.ConfirmContinue(id, false); err != nil {
			t.Fatal(err)
		}
	}
	for range 2 {
		if err := <-done; !errors.Is(err, model.ErrContinueCancelled) {
			t.Fatal(err)
		}
	}
	if len(s.slots) != 0 {
		t.Fatal("slot leaked")
	}
}

func TestAcceptedConfirmationReacquiresExecutionSlot(t *testing.T) {
	s := New(nil, &fakeDB{})
	lease := &turnLease{slots: s.slots}
	ctx := context.WithValue(context.Background(), leaseKey{}, lease)
	if err := lease.acquire(ctx); err != nil {
		t.Fatal(err)
	}
	defer lease.release()
	err := s.approveContinue(ctx, "input", "等待确认", func(e model.Event) error {
		if len(s.slots) != 0 {
			t.Error("slot was held while waiting")
		}
		return s.ConfirmContinue(continueID(t, e, "input"), true)
	})
	if err != nil || !lease.held || len(s.slots) != 1 {
		t.Fatal("approved turn did not reacquire a slot", err)
	}
}

func TestCompactedEventsKeepPartialTextAndOneFinalAnswer(t *testing.T) {
	events := []model.Event{{Type: "user", Text: "问题"}, {Type: "model_start"}}
	for range 1000 {
		events = appendEvent(events, model.Event{Type: "reasoning_delta", Text: "思"})
	}
	for range 1000 {
		events = appendEvent(events, model.Event{Type: "answer_delta", Text: "答"})
	}
	if len(events) != 4 || len([]rune(events[2].Text)) != 1000 || len([]rune(events[3].Text)) != 1000 {
		t.Fatal("delta compaction lost partial text")
	}
	events = appendEvent(events, model.Event{Type: "usage", Usage: &model.TokenUsage{Prompt: 1}})
	events = appendEvent(events, model.Event{Type: "answer", Text: "最终回答"})
	for _, e := range events {
		if e.Type == "answer_delta" {
			t.Fatal("final answer duplicated streaming answer")
		}
	}
	if events[len(events)-1].Text != "最终回答" {
		t.Fatal("final answer missing")
	}
}

func TestTurnOutcomeUsesReadableTimeoutAndStoppedCancellation(t *testing.T) {
	for _, err := range []error{context.Canceled, errWriteCancelled, model.ErrContinueCancelled} {
		status, e := TurnOutcome(err)
		if status != "cancelled" || e.Type != "stopped" {
			t.Fatal(status, e)
		}
	}
	_, e := TurnOutcome(context.DeadlineExceeded)
	if e.Type != "error" || !strings.Contains(e.Text, "超时") || strings.Contains(e.Text, "context") {
		t.Fatal(e)
	}
	_, e = TurnOutcome(&fs.PathError{Op: "rename", Path: "private", Err: fs.ErrPermission})
	if strings.Contains(e.Text, "private") || !strings.Contains(e.Text, "读写失败") {
		t.Fatal(e)
	}
}

type blockedRepository struct {
	*localstate.Store
	block            atomic.Bool
	entered, release chan struct{}
}

func (r *blockedRepository) Save(ctx context.Context, v model.Conversation) (model.Conversation, error) {
	if r.block.Load() {
		close(r.entered)
		<-r.release
	}
	return r.Store.Save(ctx, v)
}

func TestSlowCheckpointDoesNotHoldServiceMutex(t *testing.T) {
	ctx := context.Background()
	r := &blockedRepository{Store: localstate.New(t.TempDir()), entered: make(chan struct{}), release: make(chan struct{})}
	s := New(nil, &fakeDB{}, r)
	first, _ := s.Create(ctx)
	second, _ := s.Create(ctx)
	r.block.Store(true)
	finished := make(chan error, 1)
	go func() { _, err := s.Rename(ctx, first, "重命名"); finished <- err }()
	<-r.entered
	viewed := make(chan error, 1)
	go func() { _, err := s.View(ctx, second); viewed <- err }()
	select {
	case err := <-viewed:
		if err != nil {
			t.Error(err)
		}
	case <-time.After(time.Second):
		t.Error("disk I/O held global service mutex")
	}
	close(r.release)
	if err := <-finished; err != nil {
		t.Fatal(err)
	}
}

func TestHistoryPagesStayBoundedAndRejectChangedRevision(t *testing.T) {
	s := New(nil, &fakeDB{})
	id, _ := s.Create(context.Background())
	for range 600 {
		s.sessions[id].events = append(s.sessions[id].events, model.Event{Type: "user", Text: "问题"})
	}
	page, err := s.ViewPage(context.Background(), id, 0, 0)
	if err != nil || len(page.Events) != 256 || page.NextOffset == nil || *page.NextOffset != 256 {
		t.Fatal(page, err)
	}
	s.sessions[id].eventVersion++
	if _, err := s.ViewPage(context.Background(), id, *page.NextOffset, page.Revision, page.EventVersion); !errors.Is(err, model.ErrConflict) {
		t.Fatal("mixed uncheckpointed history events", err)
	}
	s.sessions[id].revision++
	if _, err := s.ViewPage(context.Background(), id, *page.NextOffset, 99); !errors.Is(err, model.ErrConflict) {
		t.Fatal("mixed history revisions", err)
	}
}

func TestInterruptedStatusIsPersistedOnce(t *testing.T) {
	ctx := context.Background()
	r := localstate.New(t.TempDir())
	id := strings.Repeat("a", 48)
	_, err := r.Save(ctx, model.Conversation{ID: id, Status: "running", Messages: []model.Message{{Role: "system", Content: "rules"}}, Events: []model.Event{{Type: "user", Text: "未完成"}}})
	if err != nil {
		t.Fatal(err)
	}
	first, err := New(nil, &fakeDB{}, r).View(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	stored, _ := r.Load(ctx, id)
	second, err := New(nil, &fakeDB{}, r).View(ctx, id)
	if err != nil || stored.Status != "interrupted" || len(first.Events) != len(second.Events) {
		t.Fatal("interruption was not idempotent", err)
	}
}
