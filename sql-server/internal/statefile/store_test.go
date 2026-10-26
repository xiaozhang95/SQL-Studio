package statefile

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sql-studio/internal/model"
	"sync"
	"testing"
)

func TestRoundTripConflict(t *testing.T) {
	dir := t.TempDir()
	s, _ := Open(dir)
	ctx := context.Background()
	doc, err := s.Read(ctx, "workspace")
	if err != nil || doc.Revision != 0 {
		t.Fatal(doc, err)
	}
	doc, err = s.Write(ctx, "workspace", model.StateWrite{Data: json.RawMessage(`{"version":1}`)})
	if err != nil || doc.Revision != 1 {
		t.Fatal(doc, err)
	}
	reopened, _ := Open(dir)
	doc, err = reopened.Read(ctx, "workspace")
	if err != nil || doc.Revision != 1 {
		t.Fatal(doc, err)
	}
	if _, err = s.Write(ctx, "workspace", model.StateWrite{Data: json.RawMessage("{}")}); !errors.Is(err, model.ErrStateConflict) {
		t.Fatal(err)
	}
	if _, err = s.Read(ctx, "../x"); err == nil {
		t.Fatal("unsafe path")
	}
}
func TestCorruptFuturePreserved(t *testing.T) {
	for _, content := range []string{"broken", `{"schemaVersion":2,"revision":1,"data":{}}`} {
		dir := t.TempDir()
		s, _ := Open(dir)
		file := filepath.Join(dir, "workspace.json")
		_ = os.WriteFile(file, []byte(content), 0600)
		if _, err := s.Write(context.Background(), "workspace", model.StateWrite{Data: json.RawMessage("{}")}); err == nil {
			t.Fatal("invalid overwritten")
		}
		bytes, _ := os.ReadFile(file)
		if string(bytes) != content {
			t.Fatal("changed")
		}
	}
}
func TestConcurrentAndCancelled(t *testing.T) {
	s, _ := Open(t.TempDir())
	var wg sync.WaitGroup
	var mu sync.Mutex
	n := 0
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Write(context.Background(), "workspace", model.StateWrite{Data: json.RawMessage("{}")})
			if err == nil {
				mu.Lock()
				n++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if n != 1 {
		t.Fatal(n)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := s.Write(ctx, "history", model.StateWrite{Data: json.RawMessage("{}")}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
func TestExtensionsPreserved(t *testing.T) {
	dir := t.TempDir()
	s, _ := Open(dir)
	_ = os.WriteFile(filepath.Join(dir, "workspace.json"), []byte(`{"schemaVersion":1,"revision":1,"data":{},"extensions":{"future":{"a":1}}}`), 0600)
	doc, err := s.Write(context.Background(), "workspace", model.StateWrite{Revision: 1, Data: json.RawMessage("{}")})
	if err != nil || string(doc.Extensions["future"]) != `{"a":1}` {
		t.Fatal(doc, err)
	}
}

func TestDeletedDirectoryRecreated(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "state")
	store, _ := Open(dir)
	ctx := context.Background()
	doc, err := store.Write(ctx, "workspace", model.StateWrite{Data: json.RawMessage("{}")})
	if err != nil {
		t.Fatal(err)
	}
	if err = os.RemoveAll(dir); err != nil {
		t.Fatal(err)
	}
	empty, err := store.Read(ctx, "workspace")
	if err != nil || empty.Revision != 0 {
		t.Fatal(empty, err)
	}
	doc, err = store.Write(ctx, "workspace", model.StateWrite{Revision: doc.Revision, Data: json.RawMessage("{}")})
	if err != nil || doc.Revision != 2 {
		t.Fatal(doc, err)
	}
	if _, err = store.Read(ctx, "workspace"); err != nil {
		t.Fatal(err)
	}
}
