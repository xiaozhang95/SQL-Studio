import assert from 'node:assert/strict'
import test from 'node:test'

import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'

import { mysqlCompletion } from '../src/databases/mysql/completion/index.ts'
import { postgresqlCompletion } from '../src/databases/postgresql/completion/index.ts'
import { buildAIContext } from '../src/pages/workspace/utils/aiContext/index.ts'
import { normalizeHistories, retainConnectionHistories } from '../src/pages/workspace/utils/queryHistory/index.ts'

test('restored histories retain the latest 50 per connection and remove deleted owners only', () => {
  const records = Array.from({ length: 85 }, (_, i) => ({ id: String(i), connectionId: 'a', sql: `-- 历史记录\nSELECT ${i};` }))
  let cleaned = 0
  const histories = normalizeHistories({ a: records, b: [{ id: 'b0', connectionId: 'b', sql: 'SELECT 2;' }] }, (sql) => {
    cleaned++
    return sql.replace('-- 历史记录\n', '')
  })
  assert.equal(histories.a.length, 50)
  assert.equal(histories.a[0].id, '0')
  assert.equal(histories.a.at(-1).id, '49')
  assert.equal(cleaned, 51)
  assert.equal(records.length, 85)
  assert.equal(retainConnectionHistories(histories, ['a', 'b']), histories)
  assert.deepEqual(retainConnectionHistories(histories, ['b']), { b: histories.b })
  assert.throws(() => normalizeHistories({ a: [{ connectionId: 'b', sql: 'SELECT 1' }] }, (sql) => sql), /格式不受支持/)
})

test('AI context selects referenced and current tables from 10000 cached tables without mutating metadata', () => {
  const tables = Array.from({ length: 10000 }, (_, i) => ({ name: `t_${i}`, type: 'BASE TABLE', comment: 'x'.repeat(2100) }))
  const scope = { connectionId: 'a', database: 'db', table: 't_9998' }
  const columns = Array.from({ length: 150 }, (_, i) => ({ name: `c_${i}`, type: 'varchar', key: '', comment: 'y'.repeat(200) }))
  const context = buildAIContext(scope, tables, { '["db","t_9999"]': { columns } }, 'SELECT * FROM `db`.`t_9999`')
  assert.equal(context.connectionId, 'a')
  assert.equal(context.tables[0].name, 't_9998')
  assert.equal(context.tables[1].name, 't_9999')
  assert.equal(context.tables.length, 12)
  assert.equal(context.tables[1].columns.length, 128)
  assert.equal(context.tables[1].columns[0].length, 128)
  assert.equal(context.tables[0].comment.length, 2000)
  assert.equal(tables[0].name, 't_0')
  const quoted = buildAIContext({ ...scope, table: '' }, [{ name: 'order`item', comment: '' }], {}, 'SELECT * FROM `order``item`')
  assert.equal(quoted.tables[0].name, 'order`item')
})

test('native SQL completion still supports database prefixes, aliases and cached fields', async () => {
  const support = mysqlCompletion({ database: 'db', table: '', schema: { db: { orders: ['id', 'total'], users: ['name'] }, other: { audit: ['event'] } } })
  async function labels(doc, pos = doc.length) {
    const state = EditorState.create({ doc, extensions: [support] })
    const sources = state.languageDataAt('autocomplete', pos)
    const results = await Promise.all(sources.map((source) => source(new CompletionContext(state, pos, true))))
    return new Set(results.flatMap((result) => result?.options.map((item) => item.label) || []))
  }
  assert.ok((await labels('SELECT * FROM ')).has('orders'))
  assert.ok((await labels('SELECT * FROM other.')).has('audit'))
  const alias = await labels('SELECT o. FROM orders o', 9)
  assert.ok(alias.has('id'))
  assert.ok(alias.has('total'))
  assert.ok(!alias.has('name'))
})

test('PostgreSQL completion uses the selected schema and keeps cross-schema aliases separate', async () => {
  const support = postgresqlCompletion({ database: 'db', namespace: 'cron', table: '', schema: { db: { '"cron"."jobs"': ['job_id'], '"public"."users"': ['user_id'] } } })
  async function labels(doc, pos = doc.length) {
    const state = EditorState.create({ doc, extensions: [support] })
    const sources = state.languageDataAt('autocomplete', pos)
    const results = await Promise.all(sources.map((source) => source(new CompletionContext(state, pos, true))))
    return new Set(results.flatMap((result) => result?.options.map((item) => item.label) || []))
  }
  assert.ok((await labels('SELECT * FROM ')).has('jobs'))
  assert.ok((await labels('SELECT * FROM public.')).has('users'))
  const alias = await labels('SELECT j. FROM jobs j', 9)
  assert.ok(alias.has('job_id'))
  assert.ok(!alias.has('user_id'))
})
