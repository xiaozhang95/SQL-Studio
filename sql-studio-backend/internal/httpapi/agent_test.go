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

func TestLongAgentMessageCanBeStoppedThroughHTTP(t *testing.T) {
	g := agentTestModel{make(chan struct{})}
	services, a := agentFixture(t, g)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	id, err := a.Create(ctx)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(services))
	defer server.Close()
	post := func(path string, body any) *http.Response {
		t.Helper()
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, server.URL+"/api/agent/"+path, strings.NewReader(string(payload)))
		if err != nil {
			t.Fatal(err)
		}
		res, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	message := "长输入" + strings.Repeat("\x01", model.MessageNoticeBytes)
	res := post("chat", map[string]string{"sessionId": id, "message": message})
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK || !strings.HasPrefix(res.Header.Get("Content-Type"), "text/event-stream") {
		t.Fatal("long JSON request did not start SSE", res.StatusCode)
	}
	scan := bufio.NewScanner(res.Body)
	var token string
	var stopped, done bool
	for scan.Scan() {
		line, ok := strings.CutPrefix(scan.Text(), "data: ")
		if !ok {
			continue
		}
		var event model.Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			t.Fatal(err)
		}
		switch event.Type {
		case "continue_confirmation":
			var approval struct {
				ID string `json:"approvalId"`
			}
			if err := json.Unmarshal(event.Result, &approval); err != nil || approval.ID == "" {
				t.Fatal("missing approval")
			}
			token = approval.ID
			decision := map[string]any{"approvalId": token, "allow": false}
			for _, step := range []struct {
				path   string
				status int
			}{
				{"write-confirmation", 400},
				{"continue-confirmation", 200},
				{"continue-confirmation", 400},
			} {
				reply := post(step.path, decision)
				_ = reply.Body.Close()
				if reply.StatusCode != step.status {
					t.Fatalf("%s returned %d", step.path, reply.StatusCode)
				}
			}
		case "stopped":
			stopped = true
		case "done":
			done = true
		case "error", "model_start":
			t.Fatal("unexpected SSE event", event.Type)
		}
	}
	if err := scan.Err(); err != nil || token == "" || !stopped || !done {
		t.Fatalf("incomplete consent stream stopped=%v done=%v error=%v", stopped, done, err)
	}
}

func TestAgentEnsureAndRenameRoute(t *testing.T) {
	services, _ := agentFixture(t, agentTestModel{})
	router := New(services)
	request := func(method, path, body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(method, "http://127.0.0.1:8080/api/agent"+path, strings.NewReader(body)))
		return w
	}
	first := request("POST", "/sessions", `{"ensure":true}`)
	var created struct {
		ID string `json:"id"`
	}
	if first.Code != 200 || json.Unmarshal(first.Body.Bytes(), &created) != nil || created.ID == "" {
		t.Fatal(first.Code, first.Body.String())
	}
	again := request("POST", "/sessions", `{"ensure":true}`)
	if again.Code != 200 || again.Body.String() != first.Body.String() {
		t.Fatal("ensure created another record")
	}
	for _, body := range []string{`null`, `{"title":""}`, `{"title":"name","allowWrite":true}`, `{"title":"name"} {}`} {
		if w := request("PATCH", "/sessions/"+created.ID, body); w.Code != 400 {
			t.Fatal(body, w.Code)
		}
	}
	renamed := request("PATCH", "/sessions/"+created.ID, `{"title":"我的会话"}`)
	if renamed.Code != 200 || !strings.Contains(renamed.Body.String(), "我的会话") {
		t.Fatal(renamed.Code, renamed.Body.String())
	}
	restored := request("GET", "/sessions/"+created.ID, "")
	if restored.Code != 200 || !strings.Contains(restored.Body.String(), "我的会话") {
		t.Fatal("rename not visible")
	}
}
