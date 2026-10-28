import assert from 'node:assert/strict'
import test from 'node:test'

import { createLatestWriter } from '../src/utils/latestWriter/index.ts'

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

test('editing batches lazy document reads and flushes before switching scope', async (t) => {
  const { createEditorBuffer } = await import('../src/pages/workspace/utils/editorBuffer/index.ts')
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const commits = [],
    states = []
  let reads = 0
  const buffer = createEditorBuffer(
    (value) => commits.push(value),
    (value) => states.push(value)
  )
  const doc = (value) => () => {
    reads++
    return value
  }
  for (let i = 0; i < 100; i++) buffer.push({ id: 'a', sql: doc('SELECT ' + i) })
  assert.equal(reads, 0)
  t.mock.timers.tick(249)
  assert.equal(reads, 0)
  t.mock.timers.tick(1)
  assert.deepEqual(commits, [{ id: 'a', sql: 'SELECT 99' }])
  assert.equal(reads, 1)
  assert.deepEqual(states, [true, false])
  buffer.push({ id: 'a', sql: doc('latest before switch') })
  buffer.push({ id: 'b', sql: doc('other page') })
  assert.equal(commits.at(-1).sql, 'latest before switch')
  const exported = buffer.flush()
  assert.equal(exported.id, 'b')
  assert.equal(exported.sql, 'other page')
  t.mock.timers.tick(1000)
  assert.equal(commits.length, 3)
})

test('cursor updates preserve a pending draft and never flatten an unchanged document', async (t) => {
  const { createEditorBuffer } = await import('../src/pages/workspace/utils/editorBuffer/index.ts')
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const commits = []
  let reads = 0
  const buffer = createEditorBuffer(
    (value) => commits.push(value),
    () => {}
  )
  buffer.push({
    id: 'a',
    sql: () => {
      reads++
      return 'last character'
    },
    layout: { anchor: 1, head: 1, top: 0, left: 0 }
  })
  buffer.push({ id: 'a', layout: { anchor: 4, head: 5, top: 120, left: 0 } })
  t.mock.timers.tick(250)
  assert.equal(reads, 1)
  assert.equal(commits[0].sql, 'last character')
  assert.equal(commits[0].layout.top, 120)
  for (let i = 0; i < 20; i++) buffer.push({ id: 'a', layout: { anchor: i, head: i, top: i * 10, left: 0 } })
  t.mock.timers.tick(250)
  assert.equal(reads, 1)
  assert.equal(commits[1].sql, undefined)
  buffer.push({
    id: 'closed',
    sql: () => {
      throw Error('closed document read')
    }
  })
  buffer.discard(new Set(['closed']))
  t.mock.timers.tick(1000)
  assert.equal(commits.length, 2)
})

test('continuous edits reach a fixed deadline instead of postponing indefinitely', async (t) => {
  const { createEditorBuffer } = await import('../src/pages/workspace/utils/editorBuffer/index.ts')
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const commits = []
  const buffer = createEditorBuffer(
    (value) => commits.push(value),
    () => {}
  )
  for (let i = 0; i < 10; i++) {
    buffer.push({ id: 'a', sql: () => String(i) })
    t.mock.timers.tick(100)
  }
  assert.ok(commits.length >= 3)
  buffer.flush()
  assert.equal(commits.at(-1).sql, '9')
})

test('large result mapping touches only the visible page and keeps original keys', async () => {
  const { matchResultRows, pageResultRows, exportResultRows } = await import('../src/pages/workspace/utils/resultRows/index.ts')
  let accesses = 0
  const original = Array.from({ length: 100000 }, (_, i) => [String(i), i % 2 === 0 ? null : 'match'])
  const rows = new Proxy(original, {
    get(target, key) {
      if (/^\d+$/.test(String(key))) accesses++
      return Reflect.get(target, key)
    }
  })
  const matches = matchResultRows(rows, '')
  assert.equal(matches, null)
  assert.equal(accesses, 0)
  const page = pageResultRows(rows, [], matches, 1000)
  assert.equal(page.length, 50)
  assert.equal(page[0].key, 49950)
  assert.equal(page[49].key, 49999)
  assert.equal(accesses, 50)
  assert.equal(exportResultRows(rows, [], matches), rows)
  const found = matchResultRows(original, 'NuLl')
  assert.equal(found.length, 50000)
  assert.deepEqual(
    pageResultRows(original, [], found, 2).map((row) => row.key),
    Array.from({ length: 50 }, (_, i) => 100 + i * 2)
  )
})

test('filtered CSV includes all matching rows plus staged inserts across pages', async () => {
  const { matchResultRows, pageResultRows, exportResultRows } = await import('../src/pages/workspace/utils/resultRows/index.ts')
  const rows = Array.from({ length: 121 }, (_, i) => ['9007199254740993', i % 2 ? 'skip' : '中文MATCH', null])
  const added = [{ key: -1, cells: ['new', 'pending', null] }]
  const matches = matchResultRows(rows, '中文match')
  const page = pageResultRows(rows, added, matches, 1)
  assert.equal(page[0], added[0])
  assert.equal(page[1].key, 0)
  assert.equal(page.length, 50)
  const tail = pageResultRows(rows, added, matches, 2)
  assert.equal(tail[0].key, 98)
  const csv = exportResultRows(rows, added, matches)
  assert.equal(csv.length, 62)
  assert.equal(csv[0], added[0].cells)
  assert.equal(csv.at(-1), rows[120])
  assert.deepEqual(rows[0], ['9007199254740993', '中文MATCH', null])
})

test('editor lifecycle flushes latest text on blur/detach and ignores a stale instance', async (t) => {
  const { readFileSync } = await import('node:fs')
  const { stripTypeScriptTypes } = await import('node:module')
  const { createEditorBuffer } = await import('../src/pages/workspace/utils/editorBuffer/index.ts')
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspaceEditor/index.ts', import.meta.url), 'utf8')
  const implementation = stripTypeScriptTypes(source.slice(source.indexOf('export function useWorkspaceEditor')).replace('export function', 'function'))
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const events = new Map(),
    cleanups = [],
    commits = [],
    states = []
  const dependencies = {
    createEditorBuffer,
    useRef: (value) => ({ current: value }),
    useCallback: (value) => value,
    useLayoutEffect: (fn) => fn(),
    useEffect: (fn) => cleanups.push(fn()),
    useState: (value) => [typeof value === 'function' ? value() : value, (next) => states.push(next)],
    window: { addEventListener: (name, fn) => events.set(name, fn), removeEventListener: (name) => events.delete(name) }
  }
  const hook = new Function(...Object.keys(dependencies), implementation + ';return useWorkspaceEditor')(...Object.values(dependencies))
  const session = hook({ layouts: {}, commit: (value) => commits.push(value) })
  const view = (sql) => ({ state: { doc: { length: sql.length, toString: () => sql }, selection: { main: { anchor: 0, head: 0 } } }, scrollDOM: { scrollTop: 0, scrollLeft: 0 } })
  const a = view('SELECT latest;'),
    b = view('SELECT other;')
  session.attach('a', a)
  session.update({ view: a, docChanged: true })
  assert.equal(session.read('a', 'old'), 'SELECT latest;')
  events.get('blur')()
  assert.equal(commits.at(-1).sql, 'SELECT latest;')
  session.attach('b', b)
  session.detach(a)
  assert.equal(session.editor.current, b)
  session.update({ view: a, docChanged: true })
  session.update({ view: b, docChanged: true })
  events.get('pagehide')()
  assert.equal(commits.at(-1).id, 'b')
  session.detach(b)
  assert.equal(session.editor.current, null)
  cleanups.forEach((fn) => fn?.())
  assert.equal(events.size, 0)
  t.mock.timers.tick(1000)
  assert.ok(states.includes(true) && states.includes(false))
})

test('run and export actions read the live draft while React still has the old snapshot', async () => {
  const { readFileSync } = await import('node:fs')
  const { stripTypeScriptTypes } = await import('node:module')
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
  const action = source.slice(source.indexOf('  function getCurrentSQL()'), source.indexOf('  function openHistory()'))
  const run = source.slice(source.indexOf('  function runSQL()'), source.indexOf('  useEffect(() => {\n    executeRef.current = runSQL'))
  let selected = null,
    flushed = 0
  const exported = [],
    executed = []
  const dependencies = {
    editorSession: {
      flush: () => {
        flushed++
        return { id: 'a', sql: 'SELECT latest;' }
      },
      read: () => {
        throw Error('flush already returned current draft')
      }
    },
    activeTabRef: { current: 'a' },
    tab: { sql: 'SELECT stale;', title: 'draft' },
    exportSQL: (sql, title) => exported.push({ sql, title }),
    message: { error: () => {} },
    getSelectedSQL: () => selected,
    executeCurrentSQL: (sql) => executed.push(sql)
  }
  const actions = new Function(...Object.keys(dependencies), stripTypeScriptTypes(action + run) + ';return {runSQL,exportCurrentSQL}')(...Object.values(dependencies))
  actions.runSQL()
  selected = 'SELECT selected;'
  actions.runSQL()
  actions.exportCurrentSQL()
  assert.deepEqual(executed, ['SELECT latest;', 'SELECT selected;'])
  assert.deepEqual(exported, [{ sql: 'SELECT latest;', title: 'draft' }])
  assert.equal(flushed, 3)
})
