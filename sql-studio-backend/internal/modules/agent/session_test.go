package chat

import (
	"context"
	"errors"
	"sql-studio-backend/internal/agentstate"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"sync"
	"testing"
)

func TestEnsureEmptyHistoryCreatesOneSessionAcrossConcurrentRequests(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store := localstate.New(dir)
	s := New(nil, &fakeDB{}, store)
	var wg sync.WaitGroup
	ids := make(chan string, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			id, err := s.Ensure(ctx)
			if err != nil {
				t.Error(err)
				return
			}
			ids <- id
		}()
	}
	wg.Wait()
	close(ids)
	var selected string
	for id := range ids {
		if selected != "" && selected != id {
			t.Fatal("duplicate default sessions")
		}
		selected = id
	}
	items, err := store.List(ctx)
	if err != nil || len(items) != 1 || items[0].Title != "新建会话" {
		t.Fatal(items, err)
	}
	other, err := s.Create(ctx)
	if err != nil || other == selected {
		t.Fatal("explicit new session was not created", err)
	}
	items, _ = store.List(ctx)
	if len(items) != 2 {
		t.Fatal("new session not indexed")
	}
	restarted := New(nil, &fakeDB{}, localstate.New(dir))
	if _, err = restarted.Ensure(ctx); err != nil {
		t.Fatal(err)
	}
	items, _ = store.List(ctx)
	if len(items) != 2 {
		t.Fatal("restart created an extra default session")
	}
}

func TestRenamePersistsAndManualDefaultTitleSurvivesFirstMessage(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store := localstate.New(dir)
	generator := generatorFunc(func(context.Context, []model.Message, []model.Tool) (model.Message, error) {
		return model.Message{Role: "assistant", Content: "fixture reply"}, nil
	})
	s := New(generator, &fakeDB{}, store)
	id, err := s.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, title := range []string{"", " \t ", strings.Repeat("名", 81), "name\nline"} {
		if _, err = s.Rename(ctx, id, title); err == nil {
			t.Fatal("accepted invalid title")
		}
	}
	v, err := s.Rename(ctx, id, "  我的查询  ")
	if err != nil || v.Title != "我的查询" {
		t.Fatal(v, err)
	}
	loaded, err := New(generator, &fakeDB{}, localstate.New(dir)).View(ctx, id)
	if err != nil || loaded.Title != "我的查询" || len(loaded.Events) != 0 {
		t.Fatal("rename not restored or changed messages", loaded, err)
	}
	if _, err = s.Rename(ctx, id, "新建会话"); err != nil {
		t.Fatal(err)
	}
	restarted := New(generator, &fakeDB{}, localstate.New(dir))
	if err = restarted.Chat(ctx, id, "此问题不能覆盖手动名称", func(model.Event) error { return nil }); err != nil {
		t.Fatal(err)
	}
	loaded, err = restarted.View(ctx, id)
	if err != nil || loaded.Title != "新建会话" {
		t.Fatal("custom title overwritten", loaded, err)
	}
	restarted.sessions[id].busy = true
	if _, err = restarted.Rename(ctx, id, "busy rename"); err == nil {
		t.Fatal("busy session renamed")
	}
}

func TestRenameConflictRollsBackCachedTitle(t *testing.T) {
	ctx := context.Background()
	store := localstate.New(t.TempDir())
	s := New(nil, &fakeDB{}, store)
	id, err := s.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	external, err := store.Load(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	external.Title = "external"
	if _, err = store.Save(ctx, external); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Rename(ctx, id, "stale rename"); !errors.Is(err, model.ErrConflict) {
		t.Fatal("CAS conflict lost", err)
	}
	if s.sessions[id].title != "新建会话" || s.sessions[id].customTitle {
		t.Fatal("failed rename changed cache")
	}
}
