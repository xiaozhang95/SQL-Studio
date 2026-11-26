package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"sql-studio-backend/internal/config"
	"sql-studio-backend/internal/model"
)

func TestOracleHTTPIntegration(t *testing.T) {
	password := os.Getenv("SQLSTUDIO_ORACLE_TEST_PASSWORD")
	if password == "" {
		t.Skip("requires a disposable Oracle instance")
	}
	port, err := strconv.Atoi(os.Getenv("SQLSTUDIO_ORACLE_TEST_PORT"))
	if err != nil {
		t.Fatal(err)
	}
	user := os.Getenv("SQLSTUDIO_ORACLE_TEST_USER")
	if user == "" {
		user = "SQLSTUDIO"
	}
	temp := t.TempDir()
	application, err := New(config.Config{DataDir: filepath.Join(temp, "data"), StateDir: filepath.Join(temp, "state")})
	if err != nil {
		t.Fatal(err)
	}
	request := func(method, path string, input any, status int) string {
		t.Helper()
		body, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(method, "http://127.0.0.1/api"+path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		application.server.Handler.ServeHTTP(rec, req)
		result := rec.Body.String()
		if rec.Code != status || strings.Contains(result, password) {
			t.Fatalf("%s %s returned unexpected status %d or exposed connection credentials", method, path, rec.Code)
		}
		return result
	}
	connection := model.Connection{Name: "Oracle fixture", Host: "127.0.0.1", Port: port, Type: model.TypeOracle, Username: user, Password: password}
	request(http.MethodPost, "/connections/test", connection, http.StatusOK)
	var saved model.Connection
	if err := json.Unmarshal([]byte(request(http.MethodPost, "/connections", connection, http.StatusOK)), &saved); err != nil ||
		saved.ID == "" || saved.Database != model.DefaultOracleService || !saved.HasPassword {
		t.Fatalf("invalid saved connection metadata: %v", err)
	}
	path := "/connections/" + saved.ID
	schemaPath := path + "/schemas?database=" + saved.Database
	if body := request(http.MethodGet, schemaPath, nil, http.StatusOK); !strings.Contains(body, strconv.Quote(user)) {
		t.Fatalf("schema is missing: %s", body)
	}
	in := model.QueryRequest{Schema: user, Database: saved.Database, SQL: "SELECT 9007199254740993 AS N FROM DUAL"}
	var result model.QueryResult
	if err := json.Unmarshal([]byte(request(http.MethodPost, path+"/query", in, http.StatusOK)), &result); err != nil ||
		len(result.Rows) != 1 || result.Rows[0][0] != "9007199254740993" {
		t.Fatalf("query returned an invalid result: %v", err)
	}
	batch := model.QueryBatchRequest{Database: saved.Database, Schema: user, AllowWrite: true, Statements: []string{
		"SELECT SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA') FROM DUAL", "BEGIN NULL; END;", "SELECT q'[a;b]' FROM DUAL",
	}}
	if body := request(http.MethodPost, path+"/query-batch", batch, http.StatusOK); strings.Count(body, `"type":"statement"`) != 3 ||
		!strings.Contains(body, fmt.Sprintf(`[["%s"]]`, user)) || !strings.Contains(body, `"type":"done"`) {
		t.Fatalf("invalid batch: %s", body)
	}
	if body := request(http.MethodGet, path+"/monitor", nil, http.StatusOK); !strings.Contains(body, `"key":"tables"`) {
		t.Fatalf("monitor is missing base metrics: %s", body)
	}
}
