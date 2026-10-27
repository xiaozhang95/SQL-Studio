package mysql

import "testing"

func TestIdentifiersAndKeyword(t *testing.T) {
	if quoteIdentifier("we`ird") != "`we``ird`" {
		t.Fatal("identifier escaping failed")
	}
	if firstKeyword(" -- comment\n /* test */ SELECT 1") != "SELECT" {
		t.Fatal("comment parsing failed")
	}
	if isQuery(" /* comment */ UPDATE t SET x=1") {
		t.Fatal("mutation classified as query")
	}
	if !isQuery("WITH `update` AS (SELECT ') UPDATE' AS label) SELECT * FROM `update`") {
		t.Fatal("CTE select misclassified")
	}
	if isQuery("WITH ids AS (SELECT 1 AS id) UPDATE sample SET label='test'") {
		t.Fatal("CTE update misclassified")
	}
}
