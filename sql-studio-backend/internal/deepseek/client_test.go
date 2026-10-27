package deepseek

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sql-studio-backend/internal/model"
	"strings"
	"testing"
)

type transport func(*http.Request) (*http.Response, error)

func (t transport) RoundTrip(r *http.Request) (*http.Response, error) { return t(r) }
func TestOfficialContract(t *testing.T) {
	client := New()
	client.http.Transport = transport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != endpoint || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("endpoint/auth")
		}
		var body struct {
			Model    string `json:"model"`
			Thinking struct {
				Type string `json:"type"`
			} `json:"thinking"`
			Format struct {
				Type string `json:"type"`
			} `json:"response_format"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Model != "deepseek-v4-pro" || body.Thinking.Type != "disabled" || body.Format.Type != "json_object" {
			t.Fatal("official contract")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"choices":[{"finish_reason":"stop","message":{"content":"{\"completion\":\" 1\"}"}}]}`))}, nil
	})
	value, err := client.Generate(context.Background(), "test-key", "deepseek-v4-pro", []model.AIMessage{{Role: "user", Content: "SELECT"}}, 100)
	if err != nil || value != `{"completion":" 1"}` {
		t.Fatal(value, err)
	}
}
func TestRedactsUpstreamError(t *testing.T) {
	client := New()
	client.http.Transport = transport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 401, Body: io.NopCloser(strings.NewReader("test-key private SQL"))}, nil
	})
	_, err := client.Generate(context.Background(), "test-key", "", nil, 100)
	if err == nil || strings.Contains(err.Error(), "test-key") || strings.Contains(err.Error(), "private") {
		t.Fatal("unsafe error")
	}
}

func TestOfficialModels(t *testing.T) {
	client := New()
	client.http.Transport = transport(func(r *http.Request) (*http.Response, error) {
		if r.Method != "GET" || r.URL.String() != modelsEndpoint || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("models endpoint/auth")
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"data":[{"id":"deepseek-flash","name":"Flash"},{"id":"deepseek-v4-pro","name":"Pro"}]}`))}, nil
	})
	values, err := client.Models(context.Background(), "test-key")
	if err != nil || len(values) != 2 || values[1].ID != "deepseek-v4-pro" {
		t.Fatal(values, err)
	}
}
