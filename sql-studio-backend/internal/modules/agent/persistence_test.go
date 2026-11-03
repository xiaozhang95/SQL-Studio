package chat

import (
	"context"
	"sql-studio-backend/internal/agentstate"
	"sql-studio-backend/internal/model/agent"
	"testing"
)

type streamingMock struct {
	calls int
	stop  context.CancelFunc
}

func (m *streamingMock) Generate(context.Context, []model.Message, []model.Tool) (model.Message, error) {
	panic("unexpected nonstream call")
}
func (m *streamingMock) GenerateStream(ctx context.Context, _ []model.Message, _ []model.Tool, emit func(model.Event) error) (model.Message, error) {
	m.calls++
	if err := emit(model.Event{Type: "reasoning_delta", Text: "这是替身返回的思考内容"}); err != nil {
		return model.Message{}, err
	}
	if err := emit(model.Event{Type: "answer_delta", Text: "部分回答"}); err != nil {
		return model.Message{}, err
	}
	if m.stop != nil {
		m.stop()
		return model.Message{}, ctx.Err()
	}
	return model.Message{Role: "assistant", Content: "部分回答", Reasoning: "这是替身返回的思考内容"}, nil
}
func TestRestartRestoresHistoryWithoutExecuting(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	g := &streamingMock{}
	db := &fakeDB{}
	s := New(g, db, localstate.New(dir))
	id, err := s.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = s.Chat(ctx, id, "请解释", func(model.Event) error { return nil }); err != nil {
		t.Fatal(err)
	}
	restarted := New(&streamingMock{}, db, localstate.New(dir))
	view, err := restarted.View(ctx, id)
	if err != nil || view.Status != "completed" || len(view.Events) < 5 {
		t.Fatal(view, err)
	}
	if g.calls != 1 || db.calls != 0 {
		t.Fatal("restore replayed an operation")
	}
	if restarted.sessions[id].messages[2].Reasoning == "" {
		t.Fatal("model reasoning was not persisted")
	}
}
func TestCancellationPersistsPartialAndNoSuccessfulModelTurn(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	dir := t.TempDir()
	g := &streamingMock{stop: cancel}
	s := New(g, &fakeDB{}, localstate.New(dir))
	id, _ := s.Create(ctx)
	if err := s.Chat(ctx, id, "取消测试", func(model.Event) error { return nil }); err == nil {
		t.Fatal("cancellation ignored")
	}
	restarted := New(&streamingMock{}, &fakeDB{}, localstate.New(dir))
	v, err := restarted.View(context.Background(), id)
	if err != nil || v.Status != "cancelled" {
		t.Fatal(v, err)
	}
	if len(restarted.sessions[id].messages) != 1 {
		t.Fatal("failed model turn committed")
	}
	partial := false
	for _, e := range v.Events {
		if e.Type == "answer_delta" && e.Text == "部分回答" {
			partial = true
		}
	}
	if !partial {
		t.Fatal("partial output lost")
	}
}
func TestRestartRunningRecordMarksInterrupted(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	s := New(&streamingMock{}, &fakeDB{}, localstate.New(dir))
	id, _ := s.Create(ctx)
	record, _ := localstate.New(dir).Load(ctx, id)
	record.Status = "running"
	record.Events = []model.Event{{Type: "user", Text: "unfinished"}, {Type: "reasoning_delta", Text: "partial thinking"}}
	if _, err := localstate.New(dir).Save(ctx, record); err != nil {
		t.Fatal(err)
	}
	db := &fakeDB{}
	g := &streamingMock{}
	v, err := New(g, db, localstate.New(dir)).View(ctx, id)
	if err != nil || v.Status != "interrupted" || g.calls != 0 || db.calls != 0 {
		t.Fatal(v, err)
	}
}

func TestServiceDeleteCannotRemoveBusySession(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	service := New(&streamingMock{}, &fakeDB{}, localstate.New(dir))
	id, err := service.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	service.sessions[id].busy = true
	if err = service.Delete(id); err == nil {
		t.Fatal("busy conversation removed")
	}
	service.sessions[id].busy = false
	if err = service.Delete(id); err != nil {
		t.Fatal(err)
	}
	if _, err = New(&streamingMock{}, &fakeDB{}, localstate.New(dir)).View(ctx, id); err == nil {
		t.Fatal("deleted conversation restored")
	}
}
