package settings

import (
	"context"
	"encoding/json"
	"sql-studio-backend/internal/model"
	agentmodel "sql-studio-backend/internal/model/agent"
	"strings"
	"testing"
)

func TestAgentAndSQLUseSameAIConfig(t *testing.T) {
	ctx := context.Background()
	repo := &aiRepository{}
	s := New(repo)
	if _, err := s.UpdateAgent(ctx, agentmodel.AIUpdate{ConfigID: "not-added"}); err == nil {
		t.Fatal("unconfigured model accepted")
	}
	data := json.RawMessage(`{"activeId":"a","completionEnabled":false,"configurations":[{"id":"a","provider":"deepseek","model":"deepseek-flash","apiKey":"fixture-key-a","modelName":"deepseek-flash"},{"id":"b","provider":"deepseek","model":"deepseek-v4-pro","apiKey":"fixture-key-b","modelName":"deepseek-v4-pro"}]}`)
	doc, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: data})
	if err != nil || strings.Contains(string(doc.Data), "fixture-key-") {
		t.Fatal("write or redaction", err)
	}
	status, err := s.UpdateAgent(ctx, agentmodel.AIUpdate{ConfigID: "b"})
	if err != nil || status.Model != "deepseek-v4-pro" || len(status.Models) != 2 {
		t.Fatal("saved model selection", err)
	}
	var raw model.AIConfig
	if json.Unmarshal(repo.doc.Data, &raw) != nil || raw.ActiveID != "b" || raw.Configurations[1].APIKey != "fixture-key-b" || raw.CompletionEnabled == nil || *raw.CompletionEnabled {
		t.Fatal("wrong model/key or preference overwritten")
	}
	if _, err = s.UpdateAgent(ctx, agentmodel.AIUpdate{ConfigID: "not-added"}); err == nil {
		t.Fatal("unsaved model accepted")
	}
	if _, err = s.ClearAgent(ctx); err != nil {
		t.Fatal(err)
	}
	status, err = s.AgentStatus(ctx)
	if err != nil || status.Configured || len(status.Models) != 0 || status.Model != "" {
		t.Fatal("clear did not remove saved models", err)
	}
}

func TestSavedModelsUseDefaultWhenSelectionIsMissing(t *testing.T) {
	ctx := context.Background()
	repo := &aiRepository{}
	s := New(repo)
	data := aiData("", fixtureEntry("a", "model-a", "fixture-key-a"), fixtureEntry("b", "model-b", "fixture-key-b"))
	// A saved list from before the default setting remains usable without a write.
	repo.doc = model.StateDocument{Revision: 1, Data: data}
	doc, err := s.Read(ctx, model.AIModelsSection)
	var public model.AIConfig
	if err != nil || json.Unmarshal(doc.Data, &public) != nil || public.ActiveID != "a" || repo.doc.Revision != 1 || string(repo.doc.Data) != string(data) {
		t.Fatal("default selection was not resolved on read", err)
	}
	status, err := s.AgentStatus(ctx)
	if err != nil || !status.Configured || status.ConfigID != "a" || status.Model != "model-a" {
		t.Fatal("agent did not use the same default model", err)
	}

	doc, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: data})
	if err != nil {
		t.Fatal(err)
	}
	var raw model.AIConfig
	if json.Unmarshal(repo.doc.Data, &raw) != nil || raw.ActiveID != "a" {
		t.Fatal("default model was not persisted")
	}
	_, err = s.Write(ctx, model.AIModelsSection, model.StateWrite{Revision: doc.Revision, Data: aiData("b", fixtureEntry("a", "model-a", ""), fixtureEntry("b", "model-b", ""))})
	status, readErr := s.AgentStatus(ctx)
	if err != nil || readErr != nil || !status.Configured || status.ConfigID != "b" || status.Model != "model-b" {
		t.Fatal("model selected in settings did not become the default", err, readErr)
	}
}
