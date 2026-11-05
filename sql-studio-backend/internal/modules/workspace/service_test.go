package workspace

import (
	"context"
	"encoding/json"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
	"time"
)

type repositoryFixture struct{ commits, parts int }

func (f *repositoryFixture) ReadWorkspace(context.Context) (model.WorkspaceDocument, error) {
	return model.WorkspaceDocument{}, nil
}

type slowCollector struct {
	repositoryFixture
	started, release, finished chan struct{}
}

func (f *slowCollector) CollectWorkspaceParts(ctx context.Context) error {
	close(f.started)
	defer close(f.finished)
	select {
	case <-f.release:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
func TestCollectionDoesNotDelayCommittedSave(t *testing.T) {
	f := &slowCollector{started: make(chan struct{}), release: make(chan struct{}), finished: make(chan struct{})}
	s := New(f)
	done := make(chan error, 1)
	go func() { _, err := s.Commit(context.Background(), inputFixture()); done <- err }()
	select {
	case err := <-done:
		if err != nil {
			t.Error(err)
		}
	case <-time.After(time.Second):
		t.Error("save waited for garbage collection")
	}
	<-f.started
	close(f.release)
	<-f.finished
}
func (f *repositoryFixture) ReadWorkspacePart(context.Context, string) (json.RawMessage, error) {
	f.parts++
	return json.RawMessage(`{"sql":"fixture"}`), nil
}
func (f *repositoryFixture) CommitWorkspace(_ context.Context, input model.WorkspaceCommit) (model.WorkspaceDocument, error) {
	f.commits++
	return model.WorkspaceDocument{Revision: input.Revision + 1, Index: input.Index}, nil
}
func inputFixture() model.WorkspaceCommit {
	return model.WorkspaceCommit{Revision: 1, Index: model.WorkspaceIndex{Version: 2, Tabs: []model.WorkspacePage{{ID: "a", Kind: "query"}}, ActiveTab: "a", ResultViews: map[string]json.RawMessage{}, EditorLayouts: map[string]json.RawMessage{}, Explorer: json.RawMessage(`{}`)}, Drafts: map[string]string{"a": "SELECT fixture"}, Results: map[string]json.RawMessage{"a": json.RawMessage(`{"source":"fixture","result":{"rows":[["9007199254740993"]]}}`)}}
}
func TestWorkspaceValidationPrecedesStorage(t *testing.T) {
	f := &repositoryFixture{}
	service := New(f)
	cases := []func(*model.WorkspaceCommit){
		func(v *model.WorkspaceCommit) { v.Index.Version = 1 },
		func(v *model.WorkspaceCommit) { v.Index.Tabs = append(v.Index.Tabs, v.Index.Tabs[0]) },
		func(v *model.WorkspaceCommit) { v.Index.Tabs[0].Kind = "unknown" },
		func(v *model.WorkspaceCommit) { v.Index.ActiveTab = "other" },
		func(v *model.WorkspaceCommit) { v.Index.RunningTabID = "other" },
		func(v *model.WorkspaceCommit) { v.Drafts["other"] = "wrong scope" },
		func(v *model.WorkspaceCommit) { v.Results["a"] = json.RawMessage(`[]`) },
		func(v *model.WorkspaceCommit) { v.Index.Explorer = json.RawMessage(`null`) },
	}
	for _, change := range cases {
		input := inputFixture()
		change(&input)
		if _, err := service.Commit(context.Background(), input); err == nil {
			t.Fatal("invalid commit reached storage")
		}
	}
	if f.commits != 0 {
		t.Fatal("validation mutated storage")
	}
	valid := inputFixture()
	doc, err := service.Commit(context.Background(), valid)
	if err != nil || doc.Revision != 2 || f.commits != 1 {
		t.Fatal(err)
	}
	for _, id := range []string{"../workspace", "bad", strings.Repeat("A", 64)} {
		if _, err := service.Part(context.Background(), id); err == nil {
			t.Fatal("invalid part accepted")
		}
	}
	if f.parts != 0 {
		t.Fatal("invalid hash reached repository")
	}
}
