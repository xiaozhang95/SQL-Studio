package settings

import (
	"context"
	"encoding/json"
	"sql-studio/internal/model"
	"testing"
)

type repository struct{ writes int }

func (r *repository) Read(context.Context, string) (model.StateDocument, error) {
	return model.StateDocument{SchemaVersion: 1}, nil
}
func (r *repository) Write(context.Context, string, model.StateWrite) (model.StateDocument, error) {
	r.writes++
	return model.StateDocument{}, nil
}
func TestValidation(t *testing.T) {
	r := &repository{}
	s := New(r)
	for _, name := range []string{"../x", "", "A", "x.json"} {
		if _, err := s.Read(context.Background(), name); err == nil {
			t.Fatal(name)
		}
	}
	for _, data := range []string{"null", "[]", "broken"} {
		if _, err := s.Write(context.Background(), "workspace", model.StateWrite{Data: json.RawMessage(data)}); err == nil {
			t.Fatal(data)
		}
	}
	if r.writes != 0 {
		t.Fatal("invalid reached repo")
	}
	if _, err := s.Write(context.Background(), "future-panel", model.StateWrite{Data: json.RawMessage("{}")}); err != nil || r.writes != 1 {
		t.Fatal(err)
	}
}
