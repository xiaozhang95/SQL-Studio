package agentlayout

import (
	"context"
	localstate "sql-studio-backend/internal/agentstate"
	model "sql-studio-backend/internal/model/agent"
	"testing"
)

func TestModePersistsAcrossWorkspaceReload(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	s := New(localstate.New(dir))
	old, err := s.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	saved, err := s.Save(ctx, old.Revision, model.Layout{Mode: "write", Draft: "继续修改", Expanded: []string{}})
	if err != nil {
		t.Fatal(err)
	}
	restored, err := New(localstate.New(dir)).Read(ctx)
	if err != nil || restored.State.Mode != "write" || restored.State.Draft != "继续修改" {
		t.Fatal(restored, err)
	}
	if _, err = s.Save(ctx, saved.Revision, model.Layout{Mode: "invalid"}); err == nil {
		t.Fatal("invalid mode accepted")
	}
}
