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

func TestSavedModelsWithoutSelectionAreNotUsable(t *testing.T) {
	ctx := context.Background()
	repo := &aiRepository{}
	s := New(repo)
	_, err := s.Write(ctx, model.AIModelsSection, model.StateWrite{Data: json.RawMessage(`{"activeId":"","configurations":[{"id":"a","provider":"deepseek","model":"chosen-model","apiKey":"fixture-key","modelName":"chosen-model"}]}`)})
	if err != nil {
		t.Fatal(err)
	}
	status, err := s.AgentStatus(ctx)
	if err != nil || status.Configured || status.Model != "" || len(status.Models) != 1 {
		t.Fatal("model was auto selected", err)
	}
	status, err = s.UpdateAgent(ctx, agentmodel.AIUpdate{ConfigID: "a"})
	if err != nil || !status.Configured || status.Model != "chosen-model" {
		t.Fatal("explicit model changed or rejected", err)
	}
}
