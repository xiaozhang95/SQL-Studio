package mysql

import (
	"context"
	"database/sql/driver"
	"errors"
	"testing"
)

func TestReadIndexesPreservesCompositeAndNullableMetadata(t *testing.T) {
	f := &queryFixture{
		columns: []string{"name", "non_unique", "type", "column", "sequence", "prefix", "order"},
		rows: [][]driver.Value{
			{"PRIMARY", int64(0), "BTREE", "id", int64(1), nil, "A"},
			{"idx_user_date", int64(1), "BTREE", "user_id", int64(1), nil, "A"},
			{"idx_user_date", int64(1), "BTREE", "bill_date", int64(2), int64(12), "D"},
			{"unique_expression", int64(0), "BTREE", "", int64(1), nil, ""},
		},
	}
	rows, err := fixtureDB(t, f).QueryContext(context.Background(), "fixture")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	indexes, err := readIndexes(rows)
	if err != nil {
		t.Fatal(err)
	}
	if len(indexes) != 3 || indexes[0].Name != "PRIMARY" || !indexes[0].Unique || indexes[1].Unique || len(indexes[1].Columns) != 2 {
		t.Fatalf("index grouping or uniqueness lost: %+v", indexes)
	}
	columns := indexes[1].Columns
	if columns[0].Name != "user_id" || columns[0].PrefixLength != nil || columns[1].Name != "bill_date" || columns[1].Position != 2 || columns[1].PrefixLength == nil || *columns[1].PrefixLength != 12 || columns[1].Order != "D" {
		t.Fatalf("composite order or prefix lost: %+v", columns)
	}
	if indexes[2].Columns[0].Name != "" {
		t.Fatal("expression field was invented")
	}
}

func TestReadIndexesEmptyAndRowError(t *testing.T) {
	for _, wantErr := range []error{nil, errors.New("metadata cursor failed")} {
		f := &queryFixture{columns: []string{"name"}, rowError: wantErr}
		rows, err := fixtureDB(t, f).QueryContext(context.Background(), "fixture")
		if err != nil {
			t.Fatal(err)
		}
		indexes, err := readIndexes(rows)
		rows.Close()
		if !errors.Is(err, wantErr) || (wantErr == nil && (indexes == nil || len(indexes) != 0)) {
			t.Fatalf("empty/error metadata: %+v %v", indexes, err)
		}
	}
}
