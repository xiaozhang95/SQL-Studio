import assert from 'node:assert/strict'
import test from 'node:test'

import { stripHistoryMarkers } from '../src/databases/mysql/history/index.ts'
import { identifier, tableDataSQL } from '../src/databases/mysql/query/index.ts'
import { isSQLColumn } from '../src/databases/mysql/resultSQL/index.ts'
import { splitSQLStatements } from '../src/databases/mysql/statements/index.ts'

test('recognizes SQL definitions and statement result columns without treating ordinary metadata as SQL', () => {
  for (const name of [
    'DDL',
    'Create Table',
    'Create View',
    'Create Database',
    'Create Procedure',
    'Create Function',
    'Create Trigger',
    'Create Event',
    'SQL Original Statement',
    'Statement',
    'VIEW_DEFINITION',
    'ROUTINE_DEFINITION',
    'ACTION_STATEMENT',
    'EVENT_DEFINITION',
    'SQL_TEXT',
    'SQL',
    'Query',
    '  create_table  '
  ]) {
    assert.equal(isSQLColumn(name), true, name)
  }
  for (const name of ['Table', 'View', 'Database', 'Field', 'Type', 'Default', 'Comment', 'Info', 'sql_mode', 'character_set_client', 'description', '']) {
    assert.equal(isSQLColumn(name), false, name)
  }
})

test('MySQL table preview keeps its target explicit and escapes identifiers', () => {
  assert.equal(identifier('db`name'), '`db``name`')
  assert.equal(tableDataSQL('db`name', 'table`name'), 'SELECT * FROM `db``name`.`table``name` LIMIT 1000;')
})

test('splits complete scripts and selected fragments, ignoring empty statements', () => {
  assert.deepEqual(splitSQLStatements('SELECT 1;\nSELECT 2;'), ['SELECT 1;', 'SELECT 2;'])
  assert.deepEqual(splitSQLStatements(' ; SELECT 1;;\nSELECT 2'), ['SELECT 1;', 'SELECT 2'])
})

test('preserves semicolons inside strings and quoted identifiers', () => {
  const sql = "SELECT 'a;b', \"c;d\", `a;b`; SELECT 'it''s;ok';"
  assert.deepEqual(splitSQLStatements(sql), ['SELECT \'a;b\', "c;d", `a;b`;', "SELECT 'it''s;ok';"])
  assert.deepEqual(splitSQLStatements("SELECT 'a\\';b'; SELECT 2;"), ["SELECT 'a\\';b';", 'SELECT 2;'])
  assert.deepEqual(splitSQLStatements('SELECT `a``;b`; SELECT 2;'), ['SELECT `a``;b`;', 'SELECT 2;'])
})

test('preserves comments and ignores their delimiters and quotes', () => {
  assert.deepEqual(splitSQLStatements("-- 历史记录 ; '\nSELECT 1; # comment ;\nSELECT 2; /* ; */"), ["-- 历史记录 ; '\nSELECT 1;", '# comment ;\nSELECT 2;'])
  assert.deepEqual(splitSQLStatements("/* ; ' */ SELECT 1; -- tail ;"), ["/* ; ' */ SELECT 1;"])
  assert.deepEqual(splitSQLStatements('SELECT 1--2; SELECT 3;'), ['SELECT 1--2;', 'SELECT 3;'])
  assert.deepEqual(splitSQLStatements('SELECT 1;--\r\nSELECT 2;'), ['SELECT 1;', '--\r\nSELECT 2;'])
})

test('does not execute whitespace or ordinary comments as statements', () => {
  for (const sql of ['', '  ; ; ', '-- comment ;', '# comment ;', '/* comment ; */; -- tail']) assert.deepEqual(splitSQLStatements(sql), [])
  assert.deepEqual(splitSQLStatements('/*!80000 SELECT 1 */;'), ['/*!80000 SELECT 1 */;'])
})

test('rejects an incomplete script before any statement is submitted', () => {
  for (const sql of ["SELECT 1; SELECT 'unfinished", 'SELECT "unfinished', 'SELECT `unfinished', 'SELECT 1; /* unfinished']) {
    assert.throws(() => splitSQLStatements(sql), /未闭合/)
  }
})

test('history markers never accumulate across save and load cycles', () => {
  let sql = 'SELECT 1;'
  for (let cycle = 0; cycle < 3; cycle++) sql = stripHistoryMarkers(`-- 历史记录\n${sql}`)
  assert.equal(sql, 'SELECT 1;')
  assert.equal(stripHistoryMarkers('-- 历史记录\n-- 历史记录\nSELECT 1;\n\n-- 历史记录\nSELECT 2;'), 'SELECT 1;\n\nSELECT 2;')
  assert.equal(stripHistoryMarkers('\uFEFF  -- 历史记录 \r\nSELECT 1;\r\n\t-- 历史记录\r\nSELECT 2;'), 'SELECT 1;\r\nSELECT 2;')
})

test('history cleanup preserves SQL literals, quoted identifiers, and ordinary comments', () => {
  for (const sql of [
    "SELECT 'first\n-- 历史记录\nlast';",
    'SELECT "first\n-- 历史记录\nlast";',
    'SELECT `first\n-- 历史记录\nlast`;',
    "SELECT 'it\\'s\n-- 历史记录\nlast';",
    "SELECT 'it''s\n-- 历史记录\nlast';",
    '/*\n-- 历史记录\n*/ SELECT 1;',
    '-- 历史记录: 用户说明\nSELECT 1; -- 历史记录',
    '# -- 历史记录\nSELECT 1;'
  ])
    assert.equal(stripHistoryMarkers(`-- 历史记录\n${sql}`), sql)
})
