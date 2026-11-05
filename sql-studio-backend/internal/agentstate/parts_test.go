package agentstate

import (
	"context"
	"os"
	model "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func TestChunkedConversationExceedsOldFileLimitAndReusesHistory(t *testing.T) {
	ctx := context.Background()
	s := New(t.TempDir())
	v := model.Conversation{ID: strings.Repeat("f", 48), Messages: []model.Message{{Role: "system", Content: "rules"}}}
	for range 67 {
		v.Events = append(v.Events, model.Event{Type: "answer_delta", Text: strings.Repeat("x", 512*1024)})
	}
	saved, err := s.Save(ctx, v)
	if err != nil {
		t.Fatal("conversation still capped at 32MiB", err)
	}
	var first record
	if err := read(s.path(saved.ID, saved.Revision), &first); err != nil {
		t.Fatal(err)
	}
	if first.SchemaVersion != 2 || len(first.EventParts) != 3 || len(first.Data.Events) != 0 {
		t.Fatal("history was not chunked")
	}
	priorPath := s.partPath(saved.ID, first.EventParts[0])
	before, _ := os.Stat(priorPath)
	saved.Title = "新标题"
	saved.Events = append(saved.Events, model.Event{Type: "turn_end", Text: "completed"})
	saved, err = s.Save(ctx, saved)
	if err != nil {
		t.Fatal(err)
	}
	after, _ := os.Stat(priorPath)
	if !before.ModTime().Equal(after.ModTime()) {
		t.Fatal("unchanged history was rewritten")
	}
	loaded, err := New(s.dir).Load(ctx, saved.ID)
	if err != nil || len(loaded.Events) != 68 || loaded.Events[0].Text != v.Events[0].Text {
		t.Fatal("restart lost chunked history", err)
	}
}

func TestLegacyConversationMigratesWithoutReplacingOriginalBeforeCommit(t *testing.T) {
	ctx := context.Background()
	s := New(t.TempDir())
	v := model.Conversation{ID: strings.Repeat("e", 48), Revision: 1, Messages: []model.Message{{Role: "system", Content: "rules"}}, Events: []model.Event{{Type: "user", Text: "原文"}}}
	if err := write(ctx, s.path(v.ID, 1), record{SchemaVersion: 1, Data: v}); err != nil {
		t.Fatal(err)
	}
	if err := write(ctx, s.dir+"/conversations/index.json", index{SchemaVersion: 1, Items: []model.ConversationInfo{{ID: v.ID, Revision: 1}}}); err != nil {
		t.Fatal(err)
	}
	loaded, err := s.Load(ctx, v.ID)
	if err != nil || loaded.Events[0].Text != "原文" {
		t.Fatal(err)
	}
	saved, err := s.Save(ctx, loaded)
	if err != nil {
		t.Fatal(err)
	}
	var migrated record
	if err := read(s.path(v.ID, saved.Revision), &migrated); err != nil || migrated.SchemaVersion != 2 {
		t.Fatal(err)
	}
	if err := os.WriteFile(s.partPath(v.ID, migrated.EventParts[0]), []byte(`[{"type":"user","text":"改写"}]`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Load(ctx, v.ID); err == nil {
		t.Fatal("corrupt chunk accepted")
	}
}
