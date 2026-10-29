import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = readFileSync(new URL('../src/pages/workspace/hooks/useDataExport/index.ts', import.meta.url), 'utf8')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('export function useDataExport')).replace('export function', 'function'))

function harness(canExport) {
  const states = []
  let pickers = 0
  const dependencies = {
    useState: () => [undefined, (value) => states.push(value)],
    useRef: () => ({ current: null }),
    useEffect() {},
    createExportWriter: async () => {
      pickers++
      throw new DOMException('cancel fixture picker', 'AbortError')
    },
    getDatabaseAdapter: () => ({ tableLabel: (name) => name })
  }
  const createModel = new Function(...Object.keys(dependencies), implementation + '; return useDataExport')(...Object.values(dependencies))
  return { model: createModel(canExport), states, pickers: () => pickers }
}

test('workspace checks the target connection and closed database independently of the active page', () => {
  const workspace = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
  const start = workspace.indexOf('  const dataExport = useDataExport(')
  const code = workspace.slice(start, workspace.indexOf('\n', start))
  const createPredicate = new Function('objects', 'useDataExport', stripTypeScriptTypes(code) + '; return dataExport')
  for (const status of [undefined, 'loading', 'error', 'connected']) {
    const objects = {
      snapshots: { target: status ? { status } : undefined, active: { status: 'connected' } },
      closedDatabases: { active: ['same database'] }
    }
    const canExport = createPredicate(objects, (predicate) => predicate)
    assert.equal(canExport('target', 'same database'), status === 'connected')
    objects.closedDatabases.target = ['same database']
    assert.equal(canExport('target', 'same database'), false)
    objects.closedDatabases.target = ['another database']
    assert.equal(canExport('target', 'same database'), status === 'connected')
  }
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
