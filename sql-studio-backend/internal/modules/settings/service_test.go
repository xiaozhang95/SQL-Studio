package settings

import (
	"context"
	"encoding/json"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
)

type repository struct{ writes int }

func (r *repository) Read(context.Context, string) (model.StateDocument, error) {
	return model.StateDocument{SchemaVersion: 1}, nil
}
func (r *repository) Write(context.Context, string, model.StateWrite) (model.StateDocument, error) {
	r.writes++
	return model.StateDocument{}, nil
}
func TestValidation(t *testing.T) {
	r := &repository{}
	s := New(r)
	for _, name := range []string{"../x", "", "A", "x.json", "connections", "ai"} {
		if _, err := s.Read(context.Background(), name); err == nil {
			t.Fatal(name)
		}
		if _, err := s.Write(context.Background(), name, model.StateWrite{Data: json.RawMessage("{}")}); err == nil {
			t.Fatal("invalid section write reached repository", name)
		}
	}
	for _, data := range []string{"null", "[]", "broken"} {
		if _, err := s.Write(context.Background(), "workspace", model.StateWrite{Data: json.RawMessage(data)}); err == nil {
			t.Fatal(data)
		}
	}
	if r.writes != 0 {
		t.Fatal("invalid reached repo")
	}
	if _, err := s.Write(context.Background(), "future-panel", model.StateWrite{Data: json.RawMessage("{}")}); err != nil || r.writes != 1 {
		t.Fatal(err)
	}
}

type aiRepository struct{ doc model.StateDocument }

func (r *aiRepository) Read(context.Context, string) (model.StateDocument, error) { return r.doc, nil }
func (r *aiRepository) Write(_ context.Context, _ string, input model.StateWrite) (model.StateDocument, error) {
	if input.Revision != r.doc.Revision {
		return model.StateDocument{}, model.ErrStateConflict
	}
	r.doc = model.StateDocument{SchemaVersion: 1, Revision: input.Revision + 1, Data: input.Data}
	return r.doc, nil
}
func aiData(active string, entries ...model.AIConfiguration) json.RawMessage {
	if entries == nil {
		entries = []model.AIConfiguration{}
	}
	data, _ := json.Marshal(model.AIConfig{Configurations: entries, ActiveID: active})
	return data
}
func fixtureEntry(id, modelID, key string) model.AIConfiguration {
	return model.AIConfiguration{ID: id, Provider: "deepseek", Model: modelID, ModelName: "Display " + modelID, APIKey: key}
}
func TestAISecretAndRetention(t *testing.T) {
	ctx := context.Background()
	r := &aiRepository{}
	s := New(r)
	for _, data := range []string{`{"provider":"deepseek","apiKey":"old-key","model":"old-model"}`, `{"configurations":null,"activeId":""}`} {
		if _, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: json.RawMessage(data)}); err == nil {
			t.Fatal("old or invalid format accepted")
		}
	}
	doc, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: aiData("", fixtureEntry("a", "model-a", "fixture-key-a"), fixtureEntry("b", "model-b", "fixture-key-b"))})
	if err != nil || strings.Contains(string(doc.Data), "fixture-key-") {
		t.Fatal("write or redaction failed", err)
	}
	var public model.AIConfig
	if json.Unmarshal(doc.Data, &public) != nil || len(public.Configurations) != 2 || public.Configurations[0].APIKey != "" || public.Configurations[0].ModelName != "Display model-a" {
		t.Fatal("nested key or model name lost")
	}
	if _, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: aiData("b", fixtureEntry("a", "model-a", ""), fixtureEntry("b", "model-b", ""))}); err != nil {
		t.Fatal(err)
	}
	var raw model.AIConfig
	_ = json.Unmarshal(r.doc.Data, &raw)
	selected, ok := raw.SelectedConfiguration()
	if !ok || selected.APIKey != "fixture-key-b" || raw.Configurations[0].APIKey != "fixture-key-a" {
		t.Fatal("record keys mixed")
	}
	if _, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: aiData("")}); err != model.ErrStateConflict {
		t.Fatal("stale list accepted")
	}
}
func TestInvalidAIListsDoNotPartiallySave(t *testing.T) {
	ctx := context.Background()
	r := &aiRepository{}
	s := New(r)
	doc, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: aiData("", fixtureEntry("a", "model-a", "fixture-key"))})
	if err != nil {
		t.Fatal(err)
	}
	for _, data := range []json.RawMessage{
		aiData("", fixtureEntry("a", "model-a", ""), fixtureEntry("b", "model-a", "key-b")),
		aiData("", fixtureEntry("a", "", "")),
		aiData("", fixtureEntry("new", "model-new", "")),
		aiData("missing", fixtureEntry("a", "model-a", "")),
	} {
		if _, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: data}); err == nil {
			t.Fatal("invalid accepted")
		}
		if r.doc.Revision != doc.Revision {
			t.Fatal("partially saved")
		}
	}
}
func TestRemoveAIConfigAndRevisionProtection(t *testing.T) {
	ctx := context.Background()
	r := &aiRepository{}
	s := New(r)
	doc, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: aiData("a", fixtureEntry("a", "model-a", "fixture-key"))})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.RemoveAI(ctx, 0); err != model.ErrStateConflict {
		t.Fatal("stale removal accepted")
	}
	removed, err := s.RemoveAI(ctx, doc.Revision)
	if err != nil {
		t.Fatal(err)
	}
	var raw model.AIConfig
	_ = json.Unmarshal(removed.Data, &raw)
	if len(raw.Configurations) != 0 || raw.ActiveID != "" || raw.CompletionEnabled == nil || *raw.CompletionEnabled {
		t.Fatal("not cleared")
	}
	if _, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: aiData("a", fixtureEntry("a", "model-a", "fixture-old"))}); err != model.ErrStateConflict {
		t.Fatal("stale credential resurrected")
	}
}
