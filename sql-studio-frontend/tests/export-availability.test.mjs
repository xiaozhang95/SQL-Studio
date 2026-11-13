import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { orderDumpViews } from '../src/pages/workspace/hooks/useDataExport/orderDumpViews/index.ts'
import { canExportDatabase } from '../src/pages/workspace/utils/exportAvailability/index.ts'
import { translate } from '../src/utils/translate/index.ts'

const source = readFileSync(new URL('../src/pages/workspace/hooks/useDataExport/index.ts', import.meta.url), 'utf8')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('export function useDataExport')).replace('export function', 'function'))

function harness(canExport) {
  const states = []
  let pickers = 0
  const dependencies = {
    useTranslation: () => ({ language: 'zh-CN', t: (message, values) => translate(message, 'zh-CN', values) }),
    useState: () => [undefined, (value) => states.push(value)],
    useRef: () => ({ current: null }),
    useEffect() {},
    createExportWriter: async () => {
      pickers++
      throw new DOMException('cancel fixture picker', 'AbortError')
    },
    getDatabaseAdapter: () => ({ tableLabel: (name) => name, dumpFile: {} })
  }
  const createModel = new Function(...Object.keys(dependencies), implementation + '; return useDataExport')(...Object.values(dependencies))
  return { model: createModel(canExport), states, pickers: () => pickers }
}

test('workspace checks the target connection and closed database independently of the active page', () => {
  const workspace = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
  const start = workspace.indexOf('  const dataExport = useDataExport(')
  const code = workspace.slice(start, workspace.indexOf('\n', start))
  const createPredicate = new Function('objects', 'useDataExport', 'canExportDatabase', stripTypeScriptTypes(code) + '; return dataExport')
  for (const status of [undefined, 'loading', 'error', 'connected']) {
    const objects = {
      snapshots: { target: status ? { status, tables: {}, loadingTables: [], tableErrors: {} } : undefined, active: { status: 'connected' } },
      closedDatabases: { active: ['same database'] }
    }
    const canExport = createPredicate(objects, (predicate) => predicate, canExportDatabase)
    assert.equal(canExport('target', 'same database'), false)
    if (objects.snapshots.target) objects.snapshots.target.tables['same database'] = []
    assert.equal(canExport('target', 'same database'), status === 'connected')
    objects.closedDatabases.target = ['same database']
    assert.equal(canExport('target', 'same database'), false)
    objects.closedDatabases.target = ['another database']
    assert.equal(canExport('target', 'same database'), status === 'connected')
  }
})

test('unopened, loading and failed databases cannot export; successfully opened empty databases can', () => {
  const snapshot = { status: 'connected', tables: {}, loadingTables: [], tableErrors: {} }
  assert.equal(canExportDatabase(snapshot, [], 'db'), false)
  snapshot.tables.db = []
  assert.equal(canExportDatabase(snapshot, [], 'db'), true)
  snapshot.loadingTables.push('db')
  assert.equal(canExportDatabase(snapshot, [], 'db'), false)
  snapshot.loadingTables = []
  snapshot.tableErrors.db = 'failed'
  assert.equal(canExportDatabase(snapshot, [], 'db'), false)
})

test('unavailable targets never open the picker or create export state, for every export scope and mode', async () => {
  const calls = []
  const output = harness((id, database) => {
    calls.push([id, database])
    return false
  })
  for (const withData of [false, true]) {
    for (const [table, schema] of [
      [undefined, undefined],
      [undefined, 'public'],
      ['public.table', undefined]
    ]) {
      await output.model.start({ id: 'closed-target', name: 'fixture' }, 'same database', withData, table, schema)
    }
  }
  assert.equal(output.pickers(), 0)
  assert.equal(output.states.length, 0)
  assert.equal(calls.length, 6)
  assert.ok(calls.every(([id, database]) => id === 'closed-target' && database === 'same database'))
})

test('availability is checked again at invocation and reopening permits export', async () => {
  let connected = true
  const output = harness(() => connected)
  connected = false
  await output.model.start({ id: 'a', name: 'fixture' }, 'db', true)
  assert.equal(output.pickers(), 0)
  connected = true
  await output.model.start({ id: 'a', name: 'fixture' }, 'db', true)
  assert.equal(output.pickers(), 1)
  assert.equal(output.states[0].connectionId, 'a')
  assert.equal(output.states[0].database, 'db')
})

test('bulk dumps skip extension-owned tables before reading their DDL while explicit table export still works', async () => {
  const fixture = [
    { name: 'cron.job', type: 'BASE TABLE', extension: 'pg_cron_preload' },
    { name: 'public.items', type: 'BASE TABLE' }
  ]
  const ddlReads = []
  const chunks = []
  let state
  const deps = {
    useTranslation: () => ({ t: (message, values) => translate(message, 'zh-CN', values) }),
    useState: () => [undefined, (value) => (state = typeof value === 'function' ? value(state) : value)],
    useRef: () => ({ current: null }),
    useEffect() {},
    getDatabaseAdapter: () => ({
      tableLabel: (name) => name,
      explorer: { tableIdentity: (name) => ({ schema: name.split('.')[0] }) },
      dumpFile: { header: () => '', prepare: (_database, name) => ({ before: name, after: '' }), footer: '' }
    }),
    createExportWriter: async () => ({ write: async (sql) => chunks.push(sql), close: async () => {}, abort: async () => assert.fail('export aborted') }),
    getTables: async () => fixture,
    getSchemas: async () => ['cron', 'public'],
    getColumns: async () => [],
    getDDL: async (_id, _database, name) => {
      ddlReads.push(name)
      return { ddl: name }
    },
    orderDumpViews
  }
  const createModel = new Function(...Object.keys(deps), implementation + '; return useDataExport')(...Object.values(deps))
  const model = createModel(() => true)
  await model.start({ id: 'a', name: 'fixture' }, 'db', false)
  assert.equal(state.status, 'completed')
  assert.equal(state.total, 1)
  assert.deepEqual(ddlReads, ['public.items', 'public.items'])
  assert.ok(!chunks.includes('cron.job'))
  assert.ok(state.logs.some((line) => line.includes('已跳过 1 个')))
  await model.start({ id: 'a', name: 'fixture' }, 'db', false, 'cron.job')
  assert.equal(state.status, 'completed')
  assert.deepEqual(ddlReads.slice(-2), ['cron.job', 'cron.job'])
  assert.ok(chunks.includes('cron.job'))
})
