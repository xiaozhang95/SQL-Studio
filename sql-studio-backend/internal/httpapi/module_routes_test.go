package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/connections"
	"sql-studio-backend/internal/modules/metadata"
	"sql-studio-backend/internal/modules/query"
)

type routeDatabase struct {
	check   func(model.Connection, string, string)
	execute func(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error)
}

func (d routeDatabase) Test(_ context.Context, c model.Connection) (string, error) {
	d.check(c, "", "")
	return "fixture-version", nil
}
func (d routeDatabase) Databases(_ context.Context, c model.Connection) ([]string, error) {
	d.check(c, "", "")
	return []string{"shared db"}, nil
}
func (d routeDatabase) Tables(_ context.Context, c model.Connection, db string) ([]model.Table, error) {
	d.check(c, db, "")
	return []model.Table{{Name: "same items", Type: "BASE TABLE"}}, nil
}
func (d routeDatabase) Columns(_ context.Context, c model.Connection, ref model.TableRef) ([]model.Column, error) {
	d.check(c, ref.Database, ref.Name)
	return []model.Column{{Name: "id", Type: "bigint"}}, nil
}
func (d routeDatabase) DDL(_ context.Context, c model.Connection, ref model.TableRef) (string, error) {
	d.check(c, ref.Database, ref.Name)
	return "CREATE TABLE `same items` (`id` BIGINT)", nil
}
func (d routeDatabase) Indexes(_ context.Context, c model.Connection, ref model.TableRef) ([]model.Index, error) {
	d.check(c, ref.Database, ref.Name)
	return []model.Index{{Name: "PRIMARY", Unique: true, Type: "BTREE", Columns: []model.IndexColumn{{Name: "id", Position: 1}}}}, nil
}
func (d routeDatabase) Execute(ctx context.Context, c model.Connection, input model.QueryRequest) (model.QueryResult, error) {
	return d.execute(ctx, c, input)
}

func regressionServices(store *connection.Store, db routeDatabase) Services {
	return Services{Connections: connections.New(store, db), Metadata: metadata.New(store, db), Queries: query.New(store, db)}
}

func TestModuleRoutesKeepExplicitScope(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"alpha", "beta"} {
		saved, err := store.Save(model.Connection{Name: name, Host: "fixture", Port: 3306, Username: "test", Password: "secret-" + name})
		if err != nil {
			t.Fatal(err)
		}
		wantDB, wantTable := "", ""
		db := routeDatabase{check: func(c model.Connection, database, table string) {
			if c.ID != saved.ID || c.Password != "secret-"+name || database != wantDB || table != wantTable {
				t.Fatal("HTTP crossed connection or object scope")
			}
		}}
		db.execute = func(_ context.Context, c model.Connection, input model.QueryRequest) (model.QueryResult, error) {
			db.check(c, input.Database, "")
			if input.Limit != 1000 || input.AllowWrite || input.SQL != "SELECT 1" {
				t.Fatal("query defaults changed")
			}
			return model.QueryResult{Columns: []model.ResultColumn{{Name: "id", Type: "BIGINT"}}, Rows: [][]any{{"9007199254740993"}}, RowCount: 1, IsQuery: true}, nil
		}
		router := New(regressionServices(store, db))
		for _, operation := range []string{"databases", "tables", "columns", "indexes", "ddl", "query"} {
			wantDB, wantTable = "", ""
			if operation != "databases" {
				wantDB = "shared db"
			}
			if operation == "columns" || operation == "indexes" || operation == "ddl" {
				wantTable = "same items"
			}
			endpoint := "http://127.0.0.1:8080/api/connections/" + saved.ID + "/" + operation + "?database=" + url.QueryEscape(wantDB) + "&table=" + url.QueryEscape(wantTable)
			request := httptest.NewRequest(http.MethodGet, endpoint, nil)
			if operation == "query" {
				request = httptest.NewRequest(http.MethodPost, endpoint, strings.NewReader(`{"database":"shared db","sql":"SELECT 1"}`))
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, request)
			if rec.Code != http.StatusOK || !json.Valid(rec.Body.Bytes()) {
				t.Fatalf("%s: %d %s", operation, rec.Code, rec.Body.String())
			}
			if operation == "query" && !strings.Contains(rec.Body.String(), "9007199254740993") {
				t.Fatal("HTTP lost precision")
			}
			if strings.Contains(rec.Body.String(), "secret-") {
				t.Fatal("HTTP exposed credentials")
			}
		}
		wantDB, wantTable = "", ""
		input, _ := json.Marshal(saved)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/connections/test", strings.NewReader(string(input))))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "fixture-version") {
			t.Fatal("connection test route failed")
		}
	}
}

func TestQueryRequestValidation(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	db := routeDatabase{execute: func(context.Context, model.Connection, model.QueryRequest) (model.QueryResult, error) {
		t.Fatal("invalid request reached executor")
		return model.QueryResult{}, nil
	}}
	router := New(regressionServices(store, db))
	for _, body := range []string{
		`{"sql":"SELECT 1","unknown":true}`, `{"sql":"SELECT 1"} {}`, `["SELECT 1"]`, `null`, `{`, `{"sql":"  "}`,
		`{"sql":"` + strings.Repeat("a", maxRequestBytes) + `"}`,
	} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/connections/missing/query", strings.NewReader(body)))
		if rec.Code != http.StatusBadRequest || !json.Valid(rec.Body.Bytes()) {
			t.Fatalf("invalid body accepted: %d", rec.Code)
		}
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "http://127.0.0.1:8080/api/connections/missing/query", strings.NewReader(`{"sql":"SELECT 1"}`)))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("missing connection: %d", rec.Code)
	}
}

func TestQueryBusyIsHTTP429(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "test", Host: "fixture", Port: 3306, Username: "test"})
	if err != nil {
		t.Fatal(err)
	}
	entered, release := make(chan struct{}, 4), make(chan struct{})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	db := routeDatabase{execute: func(ctx context.Context, _ model.Connection, _ model.QueryRequest) (model.QueryResult, error) {
		entered <- struct{}{}
		select {
		case <-release:
			return model.QueryResult{}, nil
		case <-ctx.Done():
			return model.QueryResult{}, ctx.Err()
		}
	}}
	router := New(regressionServices(store, db))
	endpoint := "http://127.0.0.1:8080/api/connections/" + saved.ID + "/query"
	var group sync.WaitGroup
	defer func() { close(release); group.Wait() }()
	for i := 0; i < 4; i++ {
		group.Go(func() {
			router.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, endpoint, strings.NewReader(`{"sql":"SELECT 1"}`)).WithContext(ctx))
		})
		select {
		case <-entered:
		case <-ctx.Done():
			t.Fatal("queries failed to enter")
		}
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, endpoint, strings.NewReader(`{"sql":"SELECT 1"}`)))
	if rec.Code != http.StatusTooManyRequests || !json.Valid(rec.Body.Bytes()) {
		t.Fatalf("busy query: %d %s", rec.Code, rec.Body.String())
	}
}
