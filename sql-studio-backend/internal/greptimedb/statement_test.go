package greptimedb

import "testing"

func TestClassifyStatement(t *testing.T) {
	for _, tt := range []struct {
		sql                   string
		write, rows, rejected bool
	}{
		{sql: "SELECT ';', `a;b`, 'it''s fine'; -- done", rows: true},
		{sql: "--comment\nTQL EVAL (0, 10, '1s') vector(1)", rows: true},
		{sql: "WITH x AS (SELECT 1) SELECT * FROM x", rows: true},
		{sql: "SHOW CREATE TABLE sample", rows: true},
		{sql: "USE `sample`;"},
		{sql: "INSERT INTO sample VALUES (1)", write: true},
		{sql: "INSERT INTO sample VALUES (1)", rejected: true},
		{sql: "EXPLAIN ANALYZE INSERT INTO sample VALUES (1)", rejected: true},
		{sql: "SELECT 1; SELECT 2", rejected: true},
		{sql: "SELECT 1; SELECT 2", write: true, rejected: true},
		{sql: "SELECT ('unterminated)", rejected: true},
		{sql: "SELECT 1 /* outer /* nested */ tail */", rejected: true},
		{sql: "SELECT 1; /* trailing */", rows: true},
	} {
		t.Run(tt.sql, func(t *testing.T) {
			rows, err := classifyStatement(tt.sql, tt.write)
			if (err != nil) != tt.rejected || rows != tt.rows {
				t.Fatalf("got rows=%t, error=%v", rows, err)
			}
		})
	}
}
