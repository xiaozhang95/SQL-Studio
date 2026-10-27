import assert from 'node:assert/strict'
import test from 'node:test'

import { referencedTables } from '../src/databases/postgresql/context/index.ts'
import { insertRowSQL, updateCellSQL } from '../src/databases/postgresql/dataEditing/index.ts'
import { explorerTableIdentity, exportDDL, literal, relation, tableDataSQL, tableIdentity, tableLabel, tableListResult } from '../src/databases/postgresql/query/index.ts'
import { cleanPostgreSQLHistory, splitPostgreSQLStatements } from '../src/databases/postgresql/statements/index.ts'
import { buildAIContext } from '../src/pages/workspace/utils/aiContext/index.ts'
import { presentObjectPage, presentTableList } from '../src/pages/workspace/utils/objectPresentation/index.ts'
import { indexDescription } from '../src/pages/workspace/utils/objectTree/index.ts'

test('PostgreSQL splitter handles dollar bodies, nested comments, E strings and standard strings', () => {
  const body = "DO $body$ BEGIN RAISE NOTICE 'a;b'; END; $body$;"
  assert.deepEqual(splitPostgreSQLStatements(body + ' SELECT 1;'), [body, 'SELECT 1;'])
  assert.deepEqual(splitPostgreSQLStatements("/* outer /* nested ; */ end */ SELECT E'a\\\';b'; SELECT 2;"), ["/* outer /* nested ; */ end */ SELECT E'a\\\';b';", 'SELECT 2;'])
  assert.deepEqual(splitPostgreSQLStatements("SELECT 'a\\'; SELECT 2;"), ["SELECT 'a\\';", 'SELECT 2;'])
  assert.deepEqual(splitPostgreSQLStatements('SELECT "a;b";--no space;\nSELECT 2;'), ['SELECT "a;b";', '--no space;\nSELECT 2;'])
  assert.deepEqual(splitPostgreSQLStatements('-- comment\n/* nested /* ; */ */;'), [])
  for (const input of ["SELECT 'unfinished", 'DO $$ missing;', '/* a /* b */']) assert.throws(() => splitPostgreSQLStatements(input))
})

test('history markers inside dollar bodies remain intact', () => {
  const body = 'DO $$\n-- 历史记录\nSELECT 1;\n$$;'
  assert.equal(cleanPostgreSQLHistory('-- 历史记录\n' + body), body)
  assert.equal(cleanPostgreSQLHistory('/* nested /* x */\n-- 历史记录\n*/\nSELECT 1'), '/* nested /* x */\n-- 历史记录\n*/\nSELECT 1')
})

test('schema qualified identifiers preserve dots/quotes and cannot inject SQL', () => {
  assert.deepEqual(tableIdentity('"a.b"."t"";x"'), ['a.b', 't";x'])
  assert.equal(relation('"a.b"."t"";x"'), '"a.b"."t"";x"')
  assert.equal(tableDataSQL('physical_database', '"other"."same"'), 'SELECT * FROM "other"."same" LIMIT 1000;')
  assert.throws(() => relation('"a"."b"; DROP TABLE x;'))
  assert.equal(relation('t; DROP TABLE x;'), '"public"."t; DROP TABLE x;"')
  assert.equal(literal("a'\\b"), "E'a''\\\\b'")
  assert.throws(() => literal('a\0b'))
  assert.doesNotMatch(exportDDL('db', 't', 'CREATE TABLE t(id int);'), /USE /)
})

const columns = [
  { name: 'id', type: 'bigint', key: 'PRI', nullable: 'NO', default: null, extra: '' },
  { name: 'value', type: 'text', key: '', nullable: 'YES', default: null, extra: '' }
]
const result = { columns: [{ name: 'id' }, { name: 'value' }] }
test('PostgreSQL data editing uses explicit schema and complete primary key with optimistic value check', () => {
  const sql = updateCellSQL('db', '"a"."t"', columns, result, ['9007199254740993', null], 1, "x'y")
  assert.equal(sql, `UPDATE "a"."t" SET "value" = E'x''y' WHERE "id" IS NOT DISTINCT FROM E'9007199254740993' AND "value" IS NOT DISTINCT FROM NULL;`)
  assert.throws(() => updateCellSQL('db', 't', columns, { columns: [{ name: 'value' }] }, ['v'], 0, 'new'))
  assert.equal(insertRowSQL('db', '"a"."t"', columns, result, ['1', null]), `INSERT INTO "a"."t" ("id", "value") VALUES (E'1', NULL);`)
  assert.throws(() => insertRowSQL('db', 't', columns, result, [undefined, 'v']))
})

test('PostgreSQL primary index uses the explicit flag instead of its actual name', () => {
  assert.match(indexDescription({ name: 'orders_pkey', primary: true, unique: true, type: 'btree', columns: [{ name: 'id', position: 1, prefixLength: null, order: 'A' }] }), /^主键/)
})

test('schema-aware listings split schema/name without changing qualified SQL targets', () => {
  const rows = [
    { name: '"a.b"."same"', type: 'BASE TABLE', comment: '' },
    { name: '"other"."same"', type: 'VIEW', comment: 'view' }
  ]
  const listing = tableListResult(rows)
  assert.deepEqual(
    listing.columns.map((column) => column.name),
    ['Schema', '表名', '类型', '注释']
  )
  assert.deepEqual(listing.rows, [
    ['a.b', 'same', 'BASE TABLE', ''],
    ['other', 'same', 'VIEW', 'view']
  ])
  assert.equal(tableListResult(rows, 'other').rows.length, 1)
  assert.equal(tableDataSQL('db', rows[0].name), 'SELECT * FROM "a.b"."same" LIMIT 1000;')
  assert.equal(tableLabel(rows[0].name), '"a.b".same')
})

test('AI references resolve unqualified names in the selected schema and preserve quoted names', () => {
  const tables = [
    { name: '"public"."same"', type: 'BASE TABLE', comment: '' },
    { name: '"cron"."same"', type: 'BASE TABLE', comment: '' },
    { name: '"A.B"."Job Name"', type: 'BASE TABLE', comment: '' }
  ]
  assert.deepEqual([...referencedTables('SELECT * FROM same', tables, 'cron')], ['"cron"."same"'])
  assert.deepEqual([...referencedTables('SELECT * FROM "A.B"."Job Name" JOIN public.same ON true', tables, 'cron')], ['"public"."same"', '"A.B"."Job Name"'])
  assert.equal(referencedTables("SELECT 'FROM public.same' /* FROM cron.same */; DO $$ FROM public.same $$", tables, 'cron').size, 0)
  const context = buildAIContext({ connectionId: 'pg', database: 'db', schema: 'cron', table: '' }, tables, {}, 'SELECT * FROM same', { tableIdentity: explorerTableIdentity, referencedTables })
  assert.equal(context.schema, 'cron')
  assert.deepEqual(
    context.tables.map((table) => table.name),
    ['"cron"."same"']
  )
})

test('old structure results and page titles are presented with schema without changing identity', () => {
  const adapter = { explorer: { tableIdentity: explorerTableIdentity }, tableListResult, tableLabel }
  const result = { columns: ['表名', '类型', '注释'].map((name) => ({ name, type: '' })), rows: [['"cron"."job"', 'BASE TABLE', '']], rowCount: 1, isQuery: true }
  const view = presentTableList(result, adapter)
  assert.deepEqual(view.rows, [['cron', 'job', 'BASE TABLE', '']])
  assert.equal(result.rows[0][0], '"cron"."job"')
  const page = { id: 'a', kind: 'data', connectionId: 'pg', database: 'db', table: '"cron"."job"', title: '"cron"."job" · 数据', sql: '' }
  const shown = presentObjectPage(page, adapter)
  assert.equal(shown.title, 'cron.job · 数据')
  assert.equal(shown.table, page.table)
  assert.equal(shown.schema, 'cron')
  assert.equal(presentObjectPage({ ...page, kind: 'query', title: '自定义查询' }, adapter).title, '自定义查询')
})
