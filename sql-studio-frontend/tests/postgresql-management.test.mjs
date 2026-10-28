import assert from 'node:assert/strict'
import test from 'node:test'

import { metadataSQL as databaseSQL, definition, sql } from '../src/databases/postgresql/databaseProperties/index.ts'
import { dump, metadataSQL, querySQL } from '../src/databases/postgresql/dataDump/index.ts'
import { splitPostgreSQLStatements } from '../src/databases/postgresql/statements/index.ts'

const original = { name: 'db"name', owner: 'postgres', charset: 'UTF8', collation: 'C', ctype: 'C', connectionLimit: -1, comment: 'old' }
const values = { name: original.name, charset: '', collation: '', fields: [], confirmation: '', owner: 'postgres', connectionLimit: 20, comment: "中文'\\;$sql_studio_database$" }
const sequenceFields = [
  'column_name',
  'sequence_schema',
  'sequence_name',
  'identity_kind',
  'data_type',
  'start_value',
  'min_value',
  'max_value',
  'increment_by',
  'cache_size',
  'cycle',
  'last_value',
  'readable'
]
const sequences = (identity = '', last = '5') => ({
  columns: sequenceFields.map((name) => ({ name, type: '' })),
  rows: [['id', 'a.b', 's"eq', identity, 'bigint', '1', '1', '9223372036854775807', '1', '1', false, last, true]],
  rowCount: 1,
  truncated: false
})
const emptySequences = { columns: sequenceFields.map((name) => ({ name, type: '' })), rows: [], rowCount: 0, truncated: false }
const columns = [
  { name: 'id', type: 'bigint', extra: '', default: `nextval('"a.b"."s""eq"'::regclass)` },
  { name: 'text', type: 'text', extra: '', default: null },
  { name: 'bytes', type: 'bytea', extra: '', default: null },
  { name: 'computed', type: 'bigint', extra: 'STORED GENERATED', default: 'id + 1' }
]
const result = {
  columns: [
    { name: 'id', type: 'INT8' },
    { name: 'text', type: 'TEXT' },
    { name: 'bytes', type: 'BYTEA' },
    { name: 'computed', type: 'INT8' }
  ],
  rows: [['9007199254740993', "中文'; DROP TABLE x;\\", '\\x00ff', '9007199254740994']],
  rowCount: 1,
  truncated: false
}
const ddl = 'CREATE TABLE "a.b"."t" (id bigint, text text, bytes bytea, computed bigint GENERATED ALWAYS AS (id+1) STORED);'

test('PostgreSQL database properties validate metadata and edit as one guarded statement', () => {
  const keys = ['name', 'owner', 'encoding', 'collation', 'ctype', 'connection_limit', 'comment']
  assert.deepEqual(definition({ columns: keys.map((name) => ({ name })), rows: [[original.name, 'postgres', 'UTF8', 'C', 'C', '-1', 'old']], truncated: false }), original)
  const statement = sql(original.name, values, original)
  assert.equal(splitPostgreSQLStatements(statement).length, 1)
  assert.match(statement, /CONNECTION LIMIT 20/)
  assert.match(statement, /COMMENT ON DATABASE/)
  assert.match(statement, /数据库属性已变化/)
  assert.match(statement, /"db""name"/)
  assert.doesNotMatch(statement, /RENAME TO|CHARACTER SET/)
  assert.equal(splitPostgreSQLStatements(databaseSQL("db'; SELECT 9; --")).length, 1)
})

test('database edit rejects invalid limits, empty owner, NUL, stale names and unchanged properties', () => {
  for (const connectionLimit of [-2, 1.2, 2147483648, NaN, '1; DROP DATABASE db']) assert.throws(() => sql(original.name, { ...values, connectionLimit }, original))
  assert.throws(() => sql(original.name, { ...values, owner: '' }, original))
  assert.throws(() => sql(original.name, { ...values, comment: 'x\0y' }, original))
  assert.throws(() => sql('other', values, original))
  assert.throws(() => sql(original.name, { ...values, connectionLimit: -1, comment: 'old' }, original), /没有变化/)
  assert.throws(() => definition({ columns: [], rows: [], truncated: false }))
  assert.throws(() => definition({ columns: [], rows: [[]], truncated: true }))
  const owner = sql(original.name, { ...values, owner: 'role";--' }, original)
  assert.equal(splitPostgreSQLStatements(owner).length, 1)
  assert.ok(owner.lastIndexOf('OWNER TO') > owner.lastIndexOf('COMMENT ON DATABASE'))
})

test('PostgreSQL dump creates owned SERIAL sequence, preserves precision/binary and omits generated values', () => {
  const output = dump('db', '"a.b"."t"', ddl, result, columns, sequences())
  assert.match(output, /CREATE SCHEMA IF NOT EXISTS "a.b"/)
  assert.ok(output.indexOf('CREATE SEQUENCE') < output.indexOf('CREATE TABLE'))
  assert.match(output, /MAXVALUE 9223372036854775807/)
  assert.match(output, /ALTER SEQUENCE.*OWNED BY/)
  assert.match(output, /9007199254740993/)
  assert.match(output, /pg_catalog.decode\('00ff','hex'\)/)
  assert.match(output, /setval\(.*5, TRUE\)/)
  assert.doesNotMatch(
    output.split('\n').find((line) => line.startsWith('INSERT')),
    /computed/
  )
  assert.equal(splitPostgreSQLStatements(querySQL('db', '"a.b"."t"')).length, 1)
  assert.equal(splitPostgreSQLStatements(metadataSQL('db', '"a.b"."t"')).length, 1)
})

test('IDENTITY inserts override system values and reset its actual target sequence; empty sequence retains start', () => {
  const identityColumns = [{ ...columns[0], extra: 'IDENTITY', default: null }, ...columns.slice(1)]
  const output = dump('db', '"a.b"."t"', ddl, result, identityColumns, sequences('a'))
  assert.match(output, /OVERRIDING SYSTEM VALUE/)
  assert.doesNotMatch(output, /CREATE SEQUENCE/)
  assert.match(output, /ALTER SEQUENCE/)
  const empty = dump('db', '"a.b"."t"', ddl, { ...result, rows: [], rowCount: 0 }, columns, sequences('', null))
  assert.doesNotMatch(empty, /INSERT INTO/)
  assert.match(empty, /1, FALSE\)/)
})

test('dump rejects truncation, column drift, malformed values, external sequences and missing sequence privilege', () => {
  assert.throws(() => dump('db', '"a.b"."t"', ddl, { ...result, truncated: true }, columns, sequences()), /限制/)
  assert.throws(() => dump('db', '"a.b"."t"', ddl, result, columns, { ...sequences(), truncated: true }), /限制/)
  assert.throws(() => dump('db', '"a.b"."t"', ddl, result, columns, emptySequences), /序列/)
  const denied = sequences()
  denied.rows[0][12] = false
  assert.throws(() => dump('db', '"a.b"."t"', ddl, result, columns, denied), /权限/)
  assert.throws(() => dump('db', '"a.b"."t"', ddl, { ...result, rows: [['1']] }, columns, sequences()), /不完整/)
  assert.throws(() => dump('db', '"a.b"."t"', ddl, { ...result, rows: [['1', 'text', '\\x0', '2']] }, columns, sequences()), /BYTEA/)
  assert.throws(() => dump('db', '"a.b"."t"', ddl, result, columns.slice(1), sequences()))
})

test('dump preserves NULL, empty strings, JSON, arrays, booleans and text without sequence', () => {
  const names = ['n', 'empty', 'json', 'arr', 'flag']
  const columns = names.map((name) => ({ name, extra: '', default: null }))
  const data = { columns: names.map((name) => ({ name, type: 'TEXT' })), rows: [[null, '', '{"a":2}', '{1,NULL,3}', true]], rowCount: 1, truncated: false }
  const output = dump('db', '"public"."t"', 'CREATE TABLE "public"."t"(n text);', data, columns, emptySequences)
  assert.match(output, /VALUES \(NULL, E'', E'\{"a":2\}', E'\{1,NULL,3\}', TRUE\)/)
})
