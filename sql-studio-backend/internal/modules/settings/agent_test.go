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
