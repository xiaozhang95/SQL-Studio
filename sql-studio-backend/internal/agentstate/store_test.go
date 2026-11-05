package agentstate

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func TestConversationRevisionsRestartAndIndex(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store := New(dir)
	value := model.Conversation{ID: strings.Repeat("a", 48), Title: "demo", Status: "completed", Messages: []model.Message{{Role: "system", Content: "rules"}, {Role: "assistant", Content: "answer", Reasoning: "thinking"}}, Events: []model.Event{{Type: "reasoning_delta", Text: "thinking"}}}
	saved, err := store.Save(ctx, value)
	if err != nil {
		t.Fatal(err)
	}
	value = saved
	value.Title = "updated"
	saved, err = store.Save(ctx, value)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.Save(ctx, value); !errors.Is(err, model.ErrConflict) {
		t.Fatal("stale revision accepted")
	}
	restarted := New(dir)
	items, err := restarted.List(ctx)
	if err != nil || len(items) != 1 || items[0].Revision != 2 || items[0].Title != "updated" {
		t.Fatal(items, err)
	}
	loaded, err := restarted.Load(ctx, value.ID)
	if err != nil || loaded.Messages[1].Reasoning != "thinking" || saved.Revision != loaded.Revision {
		t.Fatal("restart lost reasoning", err)
	}
	if _, err = store.Load(ctx, "../master.key"); err == nil {
		t.Fatal("path escape accepted")
	}
	// Unreferenced content from a failed index commit is never listed or loaded.
	orphan := strings.Repeat("b", 48)
	_ = os.WriteFile(store.path(orphan, 1), []byte(`{}`), 0600)
	items, _ = store.List(ctx)
	if len(items) != 1 {
		t.Fatal("orphan was published")
	}
}
func TestLayoutCASAndCorruptionPreserved(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store := New(dir)
	initial, err := store.ReadWorkspace(ctx)
	if err != nil || initial.Revision != 0 {
		t.Fatal(err)
	}
	initial.State = model.Layout{ActiveID: strings.Repeat("c", 48), Draft: "local draft", Expanded: []string{"thinking-2"}}
	saved, err := store.WriteWorkspace(ctx, initial)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = store.WriteWorkspace(ctx, initial); !errors.Is(err, model.ErrConflict) {
		t.Fatal("layout conflict not rejected")
	}
	loaded, err := New(dir).ReadWorkspace(ctx)
	if err != nil || loaded.Revision != saved.Revision || loaded.State.Draft != "local draft" {
		t.Fatal("layout lost", err)
	}
	path := filepath.Join(dir, "layout.json")
	for _, raw := range []string{`{}`, `{"schemaVersion":2}`, `{"schemaVersion":1,"revision":1,"state":{}}`, `broken`} {
		_ = os.WriteFile(path, []byte(raw), 0600)
		if _, err = store.ReadWorkspace(ctx); err == nil {
			t.Fatal("corruption silently reset")
		}
		if _, err = store.WriteWorkspace(ctx, saved); err == nil {
			t.Fatal("corruption overwritten")
		}
		data, _ := os.ReadFile(path)
		if string(data) != raw {
			t.Fatal("file was changed")
		}
	}
}

func TestSavedConversationCorruptionCannotBeSilentlyOverwritten(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)
	ctx := context.Background()
	v, err := s.Save(ctx, model.Conversation{ID: strings.Repeat("d", 48), Title: "test", Messages: []model.Message{{Role: "system", Content: "rules"}}})
	if err != nil {
		t.Fatal(err)
	}
	path := s.path(v.ID, v.Revision)
	if err = os.WriteFile(path, []byte(`broken`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Save(ctx, v); err == nil {
		t.Fatal("overwrote corrupted conversation")
	}
	raw, _ := os.ReadFile(path)
	if string(raw) != "broken" {
		t.Fatal("corrupted source was changed")
	}
}

func TestDeleteOnlySelectedConversationAndReloadIndex(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	store := New(dir)
	for _, c := range []string{"a", "b"} {
		_, err := store.Save(ctx, model.Conversation{ID: strings.Repeat(c, 48), Title: c, Messages: []model.Message{{Role: "system", Content: "rules"}}})
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := store.Delete(ctx, strings.Repeat("a", 48)); err != nil {
		t.Fatal(err)
	}
	loaded := New(dir)
	items, err := loaded.List(ctx)
	if err != nil || len(items) != 1 || items[0].ID != strings.Repeat("b", 48) {
		t.Fatal("deleted unrelated record", items, err)
	}
	if _, err = loaded.Load(ctx, strings.Repeat("a", 48)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("deleted record can be restored", err)
	}
	if _, err = os.Stat(store.path(strings.Repeat("a", 48), 1)); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("deleted content remains indexed or on disk")
	}
	if err = loaded.Delete(ctx, strings.Repeat("b", 48)); err != nil {
		t.Fatal(err)
	}
	items, err = loaded.List(ctx)
	if err != nil || len(items) != 0 {
		t.Fatal("empty history invalid", err)
	}
}
