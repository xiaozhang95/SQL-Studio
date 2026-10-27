package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
)

// 用真实 Gin 注册表核对 Swagger 和 Markdown，新增路由不能只改其中一份。
func TestOpenAPIAndMarkdownCoverRoutes(t *testing.T) {
	var spec struct {
		OpenAPI string `json:"openapi"`
		Paths   map[string]map[string]struct {
			OperationID string                     `json:"operationId"`
			Responses   map[string]json.RawMessage `json:"responses"`
		} `json:"paths"`
	}
	if err := json.Unmarshal(openAPISpec, &spec); err != nil || spec.OpenAPI != "3.0.3" {
		t.Fatalf("invalid OpenAPI document: %v", err)
	}
	markdown, err := os.ReadFile("../../../docs/API.md")
	if err != nil {
		t.Fatal(err)
	}
	router := New(Services{})
	parameters := regexp.MustCompile(`:([a-zA-Z]+)`)
	operations := map[string]bool{}
	for _, route := range router.Routes() {
		path := parameters.ReplaceAllString(strings.TrimPrefix(route.Path, "/api"), "{$1}")
		operation, ok := spec.Paths[path][strings.ToLower(route.Method)]
		if !ok || operation.OperationID == "" || operation.Responses["200"] == nil || operation.Responses["403"] == nil {
			t.Errorf("missing operation/response: %s %s", route.Method, path)
		}
		if operations[operation.OperationID] {
			t.Errorf("duplicate operationId: %s", operation.OperationID)
		}
		operations[operation.OperationID] = true
		row := regexp.MustCompile(`(?m)^\|\s*` + regexp.QuoteMeta(route.Method) + `\s*\|\s*` + regexp.QuoteMeta("`"+path+"`") + `\s*\|`)
		if !row.Match(markdown) {
			t.Errorf("missing Markdown route: %s %s", route.Method, path)
		}
		delete(spec.Paths[path], strings.ToLower(route.Method))
	}
	for path, methods := range spec.Paths {
		if len(methods) != 0 {
			t.Errorf("undocumented implementation missing for %s: %v", path, methods)
		}
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest("GET", "http://127.0.0.1:8080/api/openapi.json", nil))
	if recorder.Code != 200 || recorder.Header().Get("Cache-Control") != "no-store" || !json.Valid(recorder.Body.Bytes()) {
		t.Fatal("OpenAPI endpoint unavailable or cached")
	}
}
