package httpapi

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"

	"sql-studio-backend/internal/connection"
	"sql-studio-backend/internal/model"
	"sql-studio-backend/internal/modules/metadata"
)

type exportDatabase struct {
	routeDatabase
	fail bool
}

func (d exportDatabase) StreamTableData(ctx context.Context, c model.Connection, ref model.TableRef, emit func(model.QueryResult) error) error {
	if c.Name != "fixture" || ref.Database != "shared" || ref.Name != "items" {
		return errors.New("wrong export scope")
	}
	if err := emit(model.QueryResult{Columns: []model.ResultColumn{{Name: "id", Type: "BIGINT"}}, Rows: [][]any{{"9007199254740993"}}, RowCount: 1, IsQuery: true}); err != nil {
		return err
	}
	if d.fail {
		return errors.New("cursor failed")
	}
	return ctx.Err()
}
func TestExportSSEScopeCompletionAndError(t *testing.T) {
	store, err := connection.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	saved, err := store.Save(model.Connection{Name: "fixture", Host: "unused", Port: 3306, Username: "u"})
	if err != nil {
		t.Fatal(err)
	}
	for _, failed := range []bool{false, true} {
		services := Services{Metadata: metadata.New(store, exportDatabase{fail: failed})}
		router := New(services)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, httptest.NewRequest("GET", "http://127.0.0.1/api/connections/"+saved.ID+"/export-data?database=shared&table=items", nil))
		body := recorder.Body.String()
		if recorder.Code != 200 || !strings.Contains(recorder.Header().Get("Content-Type"), "text/event-stream") || !strings.Contains(body, "9007199254740993") {
			t.Fatal(body)
		}
		if failed && (!strings.Contains(body, `"type":"error"`) || strings.Contains(body, `"type":"done"`)) {
			t.Fatal(body)
		}
		if !failed && !strings.Contains(body, `"type":"done"`) {
			t.Fatal(body)
		}
		invalid := httptest.NewRecorder()
		router.ServeHTTP(invalid, httptest.NewRequest("GET", "http://127.0.0.1/api/connections/"+saved.ID+"/export-data", nil))
		if invalid.Code != 400 {
			t.Fatal(invalid.Code)
		}
	}
}
