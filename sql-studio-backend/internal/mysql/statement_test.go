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

func TestReadOnlyStatementBoundary(t *testing.T) {
	for _, statement := range []string{
		"SELECT 1", "SHOW TABLES", "DESCRIBE sample", "EXPLAIN SELECT 1", "USE `example`",
		"WITH ids AS (SELECT 1) SELECT * FROM ids", "SELECT '/*! text */'", "SELECT /* ordinary /*! text */ 1",
		"SELECT /*+ MAX_EXECUTION_TIME(1000) */ 1", "SELECT 1 -- /*! not executed */\n",
	} {
		if !isReadOnlyStatement(statement) {
			t.Errorf("read query rejected: %s", statement)
		}
	}
	for _, statement := range []string{
		"CREATE TABLE blocked (id INT)", "/* comment */ ALTER TABLE sample ADD n INT", "DROP TABLE sample", "TRUNCATE TABLE sample",
		"RENAME TABLE sample TO renamed", "COMMIT", "SET autocommit=1", "CALL mutation()", "INSERT INTO sample VALUES(1)",
		"WITH ids AS (SELECT 1) UPDATE sample SET id=2", "/*! CREATE TABLE blocked (id INT) */",
		"/*!80000 CREATE TABLE blocked AS */ SELECT 1", "SELECT /*!80000 SQL_NO_CACHE */ 1",
		"/*M! CREATE TABLE blocked (id INT) */", "/*M!100100 CREATE TABLE blocked AS */ SELECT 1", "SELECT /*M! SQL_NO_CACHE */ 1",
	} {
		if isReadOnlyStatement(statement) {
			t.Errorf("unsafe read-only query accepted: %s", statement)
		}
	}
}

func TestReturningReadsRowsOnlyForTopLevelWriteClauses(t *testing.T) {
	for _, statement := range []string{"INSERT INTO t VALUES (1) RETURNING id", "DELETE FROM t WHERE id=1 RETURNING *", "REPLACE INTO t VALUES(1) RETURNING id"} {
		if !hasReturning(statement) || isReadOnlyStatement(statement) {
			t.Fatalf("incorrect RETURNING classification: %s", statement)
		}
	}
	for _, statement := range []string{"INSERT INTO t VALUES ('RETURNING')", "INSERT INTO t (`returning`) VALUES(1)", "DELETE FROM t /* RETURNING id */", "SELECT 'RETURNING'"} {
		if hasReturning(statement) {
			t.Fatalf("non-clause classified as RETURNING: %s", statement)
		}
	}
}
