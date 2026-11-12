package statefile

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
	"time"
)

func splitStore(t *testing.T) (*Store, model.WorkspaceDocument) {
	t.Helper()
	store, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	index := model.WorkspaceIndex{Version: 2, Tabs: []model.WorkspacePage{{ID: "a", Title: "one", Kind: "query", ConnectionID: "c1", Database: "same"}, {ID: "b", Title: "two", Kind: "query", ConnectionID: "c2", Database: "same"}}, ActiveTab: "a", RunningTabID: "b", ResultViews: map[string]json.RawMessage{}, EditorLayouts: map[string]json.RawMessage{}, Explorer: json.RawMessage(`{"expanded":[],"selected":[],"search":"","top":0}`), ResultHeight: 260, OpenedConnections: []string{}}
	doc, err := store.CommitWorkspace(context.Background(), model.WorkspaceCommit{Index: index, Drafts: map[string]string{"a": "SELECT 'draft-a';", "b": "SELECT 'draft-b';"}, Results: map[string]json.RawMessage{"a": json.RawMessage(`{"source":"c1/same","result":{"columns":[{"name":"n","type":"BIGINT"}],"rows":[["9007199254740993"]],"isQuery":true}}`), "b": json.RawMessage(`{"source":"c2/same","error":"fixture-error"}`)}})
	if err != nil {
		t.Fatal(err)
	}
	return store, doc
}
func TestCurrentWorkspaceAndIncrementalCommit(t *testing.T) {
	store, doc := splitStore(t)
	ctx := context.Background()
	if doc.Revision != 1 || doc.Index.Version != 2 || len(doc.Index.Tabs) != 2 || doc.Index.RunningTabID != "b" {
		t.Fatalf("initial commit: %+v", doc)
	}
	bytes, _ := os.ReadFile(filepath.Join(store.directory, model.WorkspaceIndexSection+".json"))
	if strings.Contains(string(bytes), "draft-a") || strings.Contains(string(bytes), "9007199254740993") {
		t.Fatal("heavy content leaked into index")
	}
	page := doc.Index.Tabs[0]
	draft, err := store.ReadWorkspacePart(ctx, page.DraftRef)
	if err != nil || !strings.Contains(string(draft), "draft-a") {
		t.Fatal(string(draft), err)
	}
	result, err := store.ReadWorkspacePart(ctx, page.ResultRef)
	if err != nil || !strings.Contains(string(result), "9007199254740993") {
		t.Fatal(string(result), err)
	}
	before, _ := os.ReadDir(filepath.Join(store.directory, "workspace-parts"))
	input := model.WorkspaceCommit{Revision: doc.Revision, Index: doc.Index, Drafts: map[string]string{"a": "changed"}}
	next, err := store.CommitWorkspace(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if next.Index.Tabs[0].ResultRef != page.ResultRef || next.Index.Tabs[1] != doc.Index.Tabs[1] {
		t.Fatal("unrelated result/page changed")
	}
	after, _ := os.ReadDir(filepath.Join(store.directory, "workspace-parts"))
	if len(after) != len(before)+1 {
		t.Fatal("unchanged parts were copied")
	}
	_, err = store.CommitWorkspace(ctx, input)
	if !errors.Is(err, model.ErrStateConflict) {
		t.Fatal("stale CAS accepted", err)
	}
	next.Index.ActiveTab = "b"
	layout, err := store.CommitWorkspace(ctx, model.WorkspaceCommit{Revision: next.Revision, Index: next.Index})
	if err != nil || layout.Revision != 3 {
		t.Fatal(err)
	}
	final, _ := os.ReadDir(filepath.Join(store.directory, "workspace-parts"))
	if len(final) != len(after) {
		t.Fatal("layout update created content")
	}
	reopened, _ := Open(store.directory)
	restored, err := reopened.ReadWorkspace(ctx)
	if err != nil || restored.Index.ActiveTab != "b" {
		t.Fatal(err)
	}
	if _, err = store.Write(ctx, model.WorkspaceIndexSection, model.StateWrite{Data: json.RawMessage(`{}`)}); err == nil {
		t.Fatal("generic state bypass accepted")
	}
}
func TestWorkspaceCommitFailureAndCancellationKeepIndex(t *testing.T) {
	store, doc := splitStore(t)
	ctx := context.Background()
	data, _ := json.Marshal(struct {
		SQL string `json:"sql"`
	}{"cannot-write"})
	sum := sha256.Sum256(data)
	if err := os.Mkdir(filepath.Join(store.directory, "workspace-parts", hex.EncodeToString(sum[:])+".json"), 0700); err != nil {
		t.Fatal(err)
	}
	if _, err := store.CommitWorkspace(ctx, model.WorkspaceCommit{Revision: doc.Revision, Index: doc.Index, Drafts: map[string]string{"a": "cannot-write"}}); err == nil {
		t.Fatal("invalid part target succeeded")
	}
	current, err := store.ReadWorkspace(ctx)
	if err != nil || current.Revision != doc.Revision {
		t.Fatal("failed write changed index", err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := store.CommitWorkspace(cancelled, model.WorkspaceCommit{Revision: doc.Revision, Index: current.Index, Drafts: map[string]string{"a": "cancelled"}}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if _, err := store.ReadWorkspacePart(ctx, "../workspace"); err == nil {
		t.Fatal("traversal accepted")
	}
}
func TestWorkspaceCorruptionAndCollection(t *testing.T) {
	store, doc := splitStore(t)
	ctx := context.Background()
	old := time.Now().Add(-48 * time.Hour)
	protected := filepath.Join(store.directory, "workspace-parts", doc.Index.Tabs[0].DraftRef+".json")
	_ = os.Chtimes(protected, old, old)
	orphan, err := store.part(ctx, json.RawMessage(`{"sql":"orphan"}`))
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(store.directory, "workspace-parts", orphan+".json")
	_ = os.Chtimes(file, old, old)
	if err = store.CollectWorkspaceParts(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Stat(file); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("orphan retained", err)
	}
	if _, err = os.Stat(protected); err != nil {
		t.Fatal("current content deleted", err)
	}
	if err = os.WriteFile(protected, []byte(`{"sql":"tampered"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = store.ReadWorkspacePart(ctx, doc.Index.Tabs[0].DraftRef); err == nil {
		t.Fatal("corrupt content accepted")
	}
}

func TestWorkspaceOrphanBudgetKeepsCurrentReferences(t *testing.T) {
	store, doc := splitStore(t)
	directory := filepath.Join(store.directory, "workspace-parts")
	names := []string{strings.Repeat("d", 64) + ".json", strings.Repeat("e", 64) + ".json"}
	for i, name := range names {
		file, err := os.Create(filepath.Join(directory, name))
		if err != nil {
			t.Fatal(err)
		}
		if err = file.Truncate(70 * 1024 * 1024); err != nil {
			t.Fatal(err)
		}
		_ = file.Close()
		date := time.Now().Add(time.Duration(i-2) * time.Minute)
		_ = os.Chtimes(file.Name(), date, date)
	}
	if err := store.CollectWorkspaceParts(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(directory, names[0])); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("budget did not evict oldest orphan", err)
	}
	if _, err := os.Stat(filepath.Join(directory, doc.Index.Tabs[0].ResultRef+".json")); err != nil {
		t.Fatal("current result removed", err)
	}
}

func TestWorkspaceAggregateExceedsSingleFileLimit(t *testing.T) {
	store, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	doc, err := store.ReadWorkspace(ctx)
	if err != nil {
		t.Fatal(err)
	}
	doc.Index.Tabs = []model.WorkspacePage{{ID: "a", Kind: "query"}, {ID: "b", Kind: "query"}}
	doc.Index.ActiveTab = "a"
	large := strings.Repeat("x", 17*1024*1024)
	results := map[string]json.RawMessage{}
	for _, id := range []string{"a", "b"} {
		data, _ := json.Marshal(struct {
			Source string     `json:"source"`
			Rows   [][]string `json:"rows"`
		}{id, [][]string{{large}}})
		results[id] = data
	}
	saved, err := store.CommitWorkspace(ctx, model.WorkspaceCommit{Revision: doc.Revision, Index: doc.Index, Drafts: map[string]string{"a": "SELECT a", "b": "SELECT b"}, Results: results})
	if err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(filepath.Join(store.directory, "workspace-parts"))
	var total int64
	for _, file := range entries {
		info, _ := file.Info()
		total += info.Size()
	}
	if total <= maxBytes {
		t.Fatal("test did not exceed single file limit")
	}
	index, err := os.ReadFile(filepath.Join(store.directory, model.WorkspaceIndexSection+".json"))
	if err != nil || len(index) > 4096 {
		t.Fatal("index contains heavy result", err)
	}
	reopened, _ := Open(store.directory)
	latest, err := reopened.ReadWorkspace(ctx)
	if err != nil || latest.Revision != saved.Revision {
		t.Fatal("large split workspace could not restore index", err)
	}
}

func TestWorkspaceConcurrentCommitHasSingleWinner(t *testing.T) {
	store, doc := splitStore(t)
	outcomes := make(chan error, 8)
	for i := 0; i < 8; i++ {
		go func(i int) {
			_, err := store.CommitWorkspace(context.Background(), model.WorkspaceCommit{Revision: doc.Revision, Index: doc.Index, Drafts: map[string]string{"a": strings.Repeat("x", i+1)}})
			outcomes <- err
		}(i)
	}
	winners := 0
	for i := 0; i < 8; i++ {
		err := <-outcomes
		if err == nil {
			winners++
		} else if !errors.Is(err, model.ErrStateConflict) {
			t.Fatal(err)
		}
	}
	if winners != 1 {
		t.Fatal("concurrent stale commits overwrote each other", winners)
	}
	current, err := store.ReadWorkspace(context.Background())
	if err != nil || current.Revision != 2 {
		t.Fatal(err)
	}
}
