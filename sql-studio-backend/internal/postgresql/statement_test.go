package postgresql

import "testing"

func TestStatementClassification(t *testing.T) {
	for _, sql := range []string{"SELECT 1", "/* outer /* x */ y */ SELECT 1", "WITH x AS (SELECT 1) SELECT * FROM x", "INSERT INTO t VALUES (1) RETURNING id", "WITH x AS (SELECT 1) UPDATE t SET n=2 RETURNING id", "EXPLAIN SELECT 1"} {
		if !isQuery(sql) {
			t.Fatalf("missing result classification: %s", sql)
		}
	}
	for _, sql := range []string{"UPDATE t SET name='RETURNING'", "WITH x AS (SELECT 'returning') UPDATE t SET n=2", "INSERT INTO t VALUES ($x$RETURNING$x$)", `UPDATE t SET "RETURNING"=1`, "/* SELECT */ DELETE FROM t"} {
		if isQuery(sql) {
			t.Fatalf("incorrect result classification: %s", sql)
		}
	}
}
