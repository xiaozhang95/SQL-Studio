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
	if _, err := s.UpdateAgent(ctx, agentmodel.AIUpdate{APIKey: "fixture-shared-key", Model: agentmodel.DeepSeekModel}); err != nil {
		t.Fatal(err)
	}
	doc, err := s.Read(ctx, "ai")
	if err != nil || strings.Contains(string(doc.Data), "fixture-shared-key") {
		t.Fatal("secret leaked", err)
	}
	var public model.AIConfig
	if err = json.Unmarshal(doc.Data, &public); err != nil || !public.Configured {
		t.Fatal(public, err)
	}
	if _, err = s.UpdateAgent(ctx, agentmodel.AIUpdate{Model: "deepseek-v4-pro"}); err != nil {
		t.Fatal(err)
	}
	var raw model.AIConfig
	_ = json.Unmarshal(repo.doc.Data, &raw)
	if raw.APIKey != "fixture-shared-key" || raw.Model != "deepseek-v4-pro" {
		t.Fatal("blank key not retained")
	}
	if _, err = s.ClearAgent(ctx); err != nil {
		t.Fatal(err)
	}
	status, err := s.AgentStatus(ctx)
	if err != nil || status.Configured {
		t.Fatal(status, err)
	}
}

func TestWorkspaceKeyIsVisibleToAgentAndModelChangeKeepsCompletionSetting(t *testing.T) {
	ctx := context.Background()
	repo := &aiRepository{}
	s := New(repo)
	_, err := s.Write(ctx, "ai", model.StateWrite{Data: json.RawMessage(`{"provider":"deepseek","apiKey":"workspace-fixture-key","model":"deepseek-flash","completionEnabled":false}`)})
	if err != nil {
		t.Fatal(err)
	}
	status, err := s.AgentStatus(ctx)
	if err != nil || !status.Configured || status.Model != "deepseek-flash" {
		t.Fatal(status, err)
	}
	public, _ := json.Marshal(status)
	if strings.Contains(string(public), "workspace-fixture-key") {
		t.Fatal("secret exposed")
	}
	if _, err = s.UpdateAgent(ctx, agentmodel.AIUpdate{Model: "deepseek-v4-pro"}); err != nil {
		t.Fatal(err)
	}
	var raw model.AIConfig
	if json.Unmarshal(repo.doc.Data, &raw) != nil || raw.APIKey != "workspace-fixture-key" || raw.CompletionEnabled == nil || *raw.CompletionEnabled {
		t.Fatal("Agent overwrote shared key or completion preference")
	}
	if _, err = s.RemoveAI(ctx, repo.doc.Revision); err != nil {
		t.Fatal(err)
	}
	status, err = s.AgentStatus(ctx)
	if err != nil || status.Configured {
		t.Fatal("removed workspace key remained configured", err)
	}
}
