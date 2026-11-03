package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sql-studio-backend/internal/agentstate"
	model "sql-studio-backend/internal/model/agent"
	agent "sql-studio-backend/internal/modules/agent"
	layout "sql-studio-backend/internal/modules/agentlayout"
	"sql-studio-backend/internal/modules/settings"
	"sql-studio-backend/internal/statefile"
	"strings"
	"testing"
	"time"
)

type agentTestModel struct{ finished chan struct{} }

func (agentTestModel) Generate(context.Context, []model.Message, []model.Tool) (model.Message, error) {
	panic("unexpected summary")
}
func (g agentTestModel) GenerateStream(ctx context.Context, _ []model.Message, _ []model.Tool, emit func(model.Event) error) (model.Message, error) {
	defer close(g.finished)
	if err := emit(model.Event{Type: "reasoning_delta", Text: "本地替身思考"}); err != nil {
		return model.Message{}, err
	}
	<-ctx.Done()
	return model.Message{}, ctx.Err()
}

type agentTestDB struct{}

func (agentTestDB) Connections(context.Context) ([]model.Connection, error) {
	return []model.Connection{}, nil
}
func (agentTestDB) Databases(context.Context, string) ([]string, error) { return []string{}, nil }
func (agentTestDB) Execute(context.Context, model.Target, string, string, string) (json.RawMessage, error) {
	panic("restoring must not execute")
}
func agentFixture(t *testing.T, g agentTestModel) (Services, *agent.Service) {
	t.Helper()
	state := localstate.New(t.TempDir())
	store, err := statefile.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a := agent.New(g, agentTestDB{}, state)
	return Services{Agent: a, AgentLayout: layout.New(state), Settings: settings.New(store)}, a
}
func TestMergedAgentSSEArrivesBeforeCompletionAndCancels(t *testing.T) {
	g := agentTestModel{make(chan struct{})}
	services, a := agentFixture(t, g)
	id, err := a.Create(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(services))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", server.URL+"/api/agent/chat", strings.NewReader(`{"sessionId":"`+id+`","message":"测试"}`))
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	if !strings.HasPrefix(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatal(res.Header)
	}
	scan := bufio.NewScanner(res.Body)
	seen := false
	for scan.Scan() {
		if strings.Contains(scan.Text(), `"type":"reasoning_delta"`) {
			seen = true
			break
		}
	}
	if !seen {
		t.Fatal("no incremental thinking")
	}
	select {
	case <-g.finished:
		t.Fatal("stream buffered until completion")
	default:
	}
	cancel()
	_ = res.Body.Close()
	select {
	case <-g.finished:
	case <-time.After(2 * time.Second):
		t.Fatal("cancel did not reach generator")
	}
}
func TestMergedAgentDecodeAndNamespace(t *testing.T) {
	services, _ := agentFixture(t, agentTestModel{})
	router := New(services)
	for _, body := range []string{"null", "{} {}", `{"connectionId":"x"}`} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("POST", "http://127.0.0.1:8080/api/agent/sessions", strings.NewReader(body)))
		if w.Code != 400 {
			t.Fatal(body, w.Code)
		}
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "http://127.0.0.1:8080/api/agent/settings", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), "apiKey") {
		t.Fatal(w.Code, w.Body.String())
	}
	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "http://evil.test/api/agent/sessions", nil))
	if w.Code != 403 {
		t.Fatal("local protection missing")
	}
}
