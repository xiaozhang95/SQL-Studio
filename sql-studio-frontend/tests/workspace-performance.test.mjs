import assert from 'node:assert/strict'
import test from 'node:test'

import { createWorkspaceSerializer, restoreWorkspaceResults } from '../src/pages/workspace/utils/workspaceSerialization/index.ts'
import { createLatestWriter } from '../src/utils/latestWriter/index.ts'

const result = () => ({
  columns: [{ name: 'id', type: 'BIGINT' }],
  rows: [['9007199254740993123'], [null], ['中文\n"']],
  rowCount: 3,
  affectedRows: 0,
  lastInsertId: '',
  durationMs: 1,
  truncated: false,
  isQuery: true
})
const snapshot = (r) => ({
  version: 1,
  tabs: [{ id: 'q', title: '中文"', kind: 'query', connectionId: 'c', database: 'db', table: '', sql: 'SELECT 1;' }],
  activeTab: 'q',
  runs: { q: { source: 'c/db', result: r, statements: [{ sql: 'SELECT 1;', result: r }] } },
  resultViews: {},
  editorLayouts: {},
  explorer: { expanded: [], selected: [], search: '', top: 0 },
  resultHeight: 260,
  openedConnections: ['c'],
  runningTabId: ''
})
test('complete SQL/result roundtrip, shared-result deduplication and old snapshot compatibility', () => {
  const original = snapshot(result()),
    encode = createWorkspaceSerializer(),
    stored = JSON.parse(encode(original))
  assert.equal(stored.runs.q.result, undefined)
  const restored = restoreWorkspaceResults(stored)
  assert.deepEqual(restored, original)
  assert.equal(restored.runs.q.result, restored.runs.q.statements[0].result)
  assert.deepEqual(restoreWorkspaceResults(JSON.parse(JSON.stringify(original))), original)
  const failed = { ...original, runs: { q: { source: 'c/db', error: 'failed', statements: [{ sql: 'bad', error: 'failed' }] } } }
  assert.deepEqual(restoreWorkspaceResults(JSON.parse(encode(failed))), failed)
  const independent = { ...original, runs: { q: { ...original.runs.q, result: result() } } }
  assert.deepEqual(restoreWorkspaceResults(JSON.parse(encode(independent))), independent)
})
test('twenty typing/scroll changes do not traverse unchanged result cells', () => {
  let reads = 0
  const r = result(),
    rows = r.rows
  Object.defineProperty(r, 'rows', {
    enumerable: true,
    get: () => {
      reads++
      return rows
    }
  })
  const original = snapshot(r),
    encode = createWorkspaceSerializer()
  encode(original)
  const initial = reads
  for (let i = 0; i < 20; i++) encode({ ...original, tabs: [{ ...original.tabs[0], sql: 'SELECT ' + i }], editorLayouts: { q: { top: i, anchor: 0, head: 0, left: 0 } } })
  assert.equal(reads, initial)
  const updated = { ...r, rows: [['changed']] }
  assert.ok(encode({ ...original, runs: { q: { source: 'new', result: updated } } }).includes('changed'))
})
test('backpressure saves first and latest only; conflicts reject pending saves', async () => {
  let release
  const calls = [],
    save = createLatestWriter(async (value) => {
      calls.push(value)
      if (value === 1)
        await new Promise((resolve) => {
          release = resolve
        })
    })
  const a = save(1),
    b = save(2),
    c = save(3)
  assert.deepEqual(calls, [1])
  release()
  await Promise.all([a, b, c])
  assert.deepEqual(calls, [1, 3])
  let reject
  const broken = createLatestWriter(
    async () =>
      new Promise((_, fail) => {
        reject = fail
      })
  )
  const x = broken('old'),
    y = broken('latest'),
    checks = Promise.all([assert.rejects(x, /conflict/), assert.rejects(y, /conflict/)])
  reject(new Error('conflict'))
  await checks
})
