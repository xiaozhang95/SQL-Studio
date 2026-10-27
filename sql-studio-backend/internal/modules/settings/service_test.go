package settings

import (
	"context"
	"encoding/json"
	"sql-studio-backend/internal/model"
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
	for _, name := range []string{"../x", "", "A", "x.json"} {
		if _, err := s.Read(context.Background(), name); err == nil {
			t.Fatal(name)
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
func TestAISecretAndRetention(t *testing.T) {
	ctx := context.Background()
	r := &aiRepository{}
	s := New(r)
	for _, data := range []string{`{"provider":"other","apiKey":"test-secret"}`, `{"provider":"deepseek"}`} {
		if _, err := s.Write(ctx, "ai", model.StateWrite{Data: json.RawMessage(data)}); err == nil {
			t.Fatal("accepted invalid config")
		}
	}
	doc, err := s.Write(ctx, "ai", model.StateWrite{Data: json.RawMessage(`{"provider":"deepseek","apiKey":"test-secret"}`)})
	if err != nil {
		t.Fatal(err)
	}
	if string(doc.Data) != `{"provider":"deepseek","configured":true,"completionEnabled":true}` {
		t.Fatal("secret exposed")
	}
	doc, err = s.Read(ctx, "ai")
	if err != nil || string(doc.Data) != `{"provider":"deepseek","configured":true,"completionEnabled":true}` {
		t.Fatal("read exposed secret")
	}
	_, err = s.Write(ctx, "ai", model.StateWrite{Revision: 1, Data: json.RawMessage(`{"provider":"deepseek","apiKey":""}`)})
	if err != nil {
		t.Fatal(err)
	}
	var stored model.AIConfig
	_ = json.Unmarshal(r.doc.Data, &stored)
	if stored.APIKey != "test-secret" {
		t.Fatal("blank key did not retain secret")
	}
	if _, err = s.Write(ctx, "ai", model.StateWrite{Revision: 1, Data: json.RawMessage(`{"provider":"deepseek","apiKey":"replacement"}`)}); err != model.ErrStateConflict {
		t.Fatal("missing conflict")
	}
}

func TestAIModelAndCompletionPreference(t *testing.T) {
	r := &aiRepository{}
	s := New(r)
	ctx := context.Background()
	doc, err := s.Write(ctx, "ai", model.StateWrite{Data: json.RawMessage(`{"provider":"deepseek","model":"deepseek-v4-pro","apiKey":"test-secret","completionEnabled":false}`)})
	if err != nil {
		t.Fatal(err)
	}
	var config model.AIConfig
	_ = json.Unmarshal(doc.Data, &config)
	if config.Model != "deepseek-v4-pro" || config.CompletionEnabled == nil || *config.CompletionEnabled || config.APIKey != "" {
		t.Fatal("configuration not preserved or secret leaked")
	}
	_, err = s.Write(ctx, "ai", model.StateWrite{Revision: doc.Revision, Data: json.RawMessage(`{"provider":"deepseek","apiKey":""}`)})
	if err != nil {
		t.Fatal(err)
	}
	_ = json.Unmarshal(r.doc.Data, &config)
	if config.Model != "deepseek-v4-pro" || config.CompletionEnabled == nil || *config.CompletionEnabled || config.APIKey != "test-secret" {
		t.Fatal("legacy update reset configuration")
	}
}

func TestRemoveAIConfigAndRevisionProtection(t *testing.T) {
	ctx := context.Background()
	r := &aiRepository{}
	s := New(r)
	saved, err := s.Write(ctx, "ai", model.StateWrite{Data: json.RawMessage(`{"provider":"deepseek","apiKey":"test-secret","model":"deepseek-flash"}`)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.RemoveAI(ctx, 0); err != model.ErrStateConflict {
		t.Fatal("stale removal accepted", err)
	}
	removed, err := s.RemoveAI(ctx, saved.Revision)
	if err != nil {
		t.Fatal(err)
	}
	var config model.AIConfig
	if json.Unmarshal(r.doc.Data, &config) != nil || config.APIKey != "" || config.Model != "" || config.CompletionEnabled == nil || *config.CompletionEnabled {
		t.Fatal("configuration not cleared")
	}
	if removed.Revision <= saved.Revision {
		t.Fatal("revision not advanced")
	}
	if _, err = s.Write(ctx, "ai", model.StateWrite{Revision: saved.Revision, Data: json.RawMessage(`{"provider":"deepseek","apiKey":"old-secret"}`)}); err != model.ErrStateConflict {
		t.Fatal("stale key resurrected")
	}
	if _, err = s.Write(ctx, "ai", model.StateWrite{Revision: removed.Revision, Data: json.RawMessage(`{"provider":"deepseek","apiKey":"new-secret"}`)}); err != nil {
		t.Fatal("reconfigure failed", err)
	}
}
