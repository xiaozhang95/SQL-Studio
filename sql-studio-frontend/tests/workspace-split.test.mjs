import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { setImmediate as settle } from 'node:timers/promises'

import { WorkspaceStore } from '../src/services/workspace/index.ts'
import { createLatestWriter } from '../src/utils/latestWriter/index.ts'
import { RequestError } from '../src/utils/request/index.ts'

function fixture() {
  const parts = new Map(),
    calls = []
  const put = (value) => {
    const data = JSON.stringify(value),
      hash = createHash('sha256').update(data).digest('hex')
    parts.set(hash, value)
    return hash
  }
  const tabs = Array.from({ length: 100 }, (_, i) => ({
    id: 'p' + i,
    title: 'Page ' + i,
    kind: 'query',
    connectionId: 'c' + i,
    database: 'same',
    table: '',
    draftRef: put({ sql: 'SELECT ' + i + ';' }),
    resultRef: put({ source: 'c' + i + '/same', statements: [{ sql: 'SELECT ' + i + ';', result: { columns: [{ name: 'n', type: 'BIGINT' }], rows: [['9007199254740993']], isQuery: true } }] })
  }))
  let doc = {
    revision: 1,
    index: {
      version: 2,
      tabs,
      activeTab: 'p0',
      runningTabId: '',
      resultViews: {},
      editorLayouts: {},
      explorer: { expanded: [], selected: [], search: '', top: 0 },
      resultHeight: 260,
      openedConnections: []
    }
  }
  let fail = false
  const fetch = async (url, options) => {
    calls.push({ url, body: options?.body })
    if (options?.signal?.aborted) throw options.signal.reason
    if (url.includes('/parts/')) {
      const data = parts.get(url.split('/').at(-1))
      return new Response(JSON.stringify(data ?? { error: 'missing' }), { status: data ? 200 : 404 })
    }
    if (options?.method === 'PUT') {
      const input = JSON.parse(options.body)
      if (fail || input.revision !== doc.revision) return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 })
      for (const page of input.index.tabs) {
        if (page.id in input.drafts) page.draftRef = put({ sql: input.drafts[page.id] })
        if (page.id in input.results) page.resultRef = input.results[page.id] ? put(input.results[page.id]) : ''
      }
      doc = { revision: doc.revision + 1, index: input.index }
    }
    return new Response(JSON.stringify(doc))
  }
  return {
    parts,
    calls,
    fetch,
    doc: () => doc,
    fail: () => {
      fail = true
    }
  }
}

test('stale windows retain their draft and revision after repeated conflicts', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const a = await WorkspaceStore.open(),
      b = await WorkspaceStore.open()
    const contents = await b.hydrate('p0')
    const stale = b.snapshot({ id: 'p0', ...contents })
    stale.tabs[0] = { ...stale.tabs[0], sql: 'unsaved local draft' }
    await a.commit({ ...a.snapshot(), resultHeight: 999 })
    await assert.rejects(b.commit(stale), { status: 409 })
    await assert.rejects(b.commit(stale), { status: 409 })
    assert.equal(b.doc.revision, 1)
    assert.equal(stale.tabs[0].sql, 'unsaved local draft')
    assert.equal(f.doc().revision, 2)
  } finally {
    globalThis.fetch = old
  }
})

test('workbench silently restores the latest index after a conflict and saves new edits on that revision', async (t) => {
  const f = fixture()
  const old = globalThis.fetch
  globalThis.fetch = f.fetch
  t.after(() => {
    globalThis.fetch = old
  })
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspacePersistence/index.ts', import.meta.url), 'utf8')
  const code = stripTypeScriptTypes(source.slice(source.indexOf('type Content')).replace('export function', 'function'))
  const slots = []
  const timers = new Map()
  let cursor = 0,
    timerId = 0
  const slot = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return index
  }
  const effect = (callback, deps) => {
    const index = slot({})
    const previous = slots[index]
    if (deps && previous.deps && deps.every((value, i) => Object.is(value, previous.deps[i]))) return
    previous.cleanup?.()
    slots[index] = { deps, cleanup: callback() }
  }
  const browser = Object.assign(new EventTarget(), {
    setTimeout(callback) {
      timers.set(++timerId, callback)
      return timerId
    },
    clearTimeout: (id) => timers.delete(id)
  })
  const deps = {
    WorkspaceStore,
    RequestError,
    createLatestWriter,
    window: browser,
    useLayoutEffect: effect,
    useEffect: effect,
    useCallback: (callback) => slots[slot(callback)],
    useRef: (current) => slots[slot({ current })],
    useState(initial) {
      const index = slot(initial)
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value
        }
      ]
    }
  }
  const hook = new Function(...Object.keys(deps), code + '\nreturn useWorkspacePersistence')(...Object.values(deps))
  const external = await WorkspaceStore.open()
  await external.commit({ ...external.snapshot(), activeTab: '' })
  let snapshot = external.snapshot()
  let busy = false
  let restored = 0
  const render = () => {
    cursor = 0
    return hook(
      snapshot,
      (latest) => {
        restored++
        snapshot = latest
      },
      { busy, hydrate() {}, evict: () => [] }
    )
  }
  const tick = async () => {
    const current = [...timers.values()]
    timers.clear()
    for (const callback of current) callback()
    await settle()
  }
  render()
  await settle()
  assert.equal(render().ready, true)
  await external.commit({ ...external.snapshot(), activeTab: '', resultHeight: 777 })
  snapshot = { ...snapshot, resultHeight: 333 }
  busy = true
  render()
  await tick()
  assert.equal(render().saving, false)
  assert.equal(restored, 1)
  assert.equal(f.doc().index.resultHeight, 777)
  busy = false
  render()
  await settle()
  render()
  assert.equal(restored, 2)
  assert.equal(snapshot.resultHeight, 777)
  await tick()
  snapshot = { ...snapshot, resultHeight: 888 }
  render()
  await tick()
  assert.equal(f.doc().index.resultHeight, 888)
  assert.equal(JSON.parse(f.calls.at(-1).body).revision, 3)
  slots.forEach((entry) => entry?.cleanup?.())
})

test('running batches save their index but upload cumulative results only on completion', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open()
    const contents = await store.hydrate('p0')
    const snapshot = store.snapshot({ id: 'p0', ...contents })
    snapshot.runningTabId = 'p0'
    for (let i = 1; i <= 5; i++) {
      snapshot.runs = { p0: { source: 'fixture', statements: Array.from({ length: i }, () => ({ sql: 'SELECT 1', result: contents.run.result })) } }
      await store.commit(snapshot)
    }
    const uploads = () => f.calls.filter((call) => call.body).map((call) => JSON.parse(call.body))
    assert.ok(uploads().every((body) => Object.keys(body.results).length === 0))
    snapshot.runningTabId = ''
    await store.commit(snapshot)
    assert.equal(uploads().at(-1).results.p0.statements.length, 5)
  } finally {
    globalThis.fetch = old
  }
})

test('cleared stale running marker is committed even without further edits', async () => {
  const old = globalThis.fetch,
    f = fixture()
  f.doc().index.runningTabId = 'p0'
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open()
    assert.equal(store.doc.index.runningTabId, '')
    await store.commit(store.snapshot())
    assert.equal(f.doc().index.runningTabId, '')
    assert.equal(f.doc().index.tabs[0].interrupted, true)
  } finally {
    globalThis.fetch = old
  }
})
test('100 tabs start with index only; only selected page content is hydrated', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open()
    assert.equal(f.calls.length, 1)
    const light = store.snapshot()
    assert.equal(light.tabs.length, 100)
    assert.deepEqual(light.runs, {})
    assert.ok(light.tabs.every((tab) => tab.sql === ''))
    const content = await store.hydrate('p0')
    const runtime = store.snapshot({ id: 'p0', ...content })
    assert.equal(f.calls.length, 3)
    assert.equal(runtime.tabs[0].sql, 'SELECT 0;')
    assert.equal(runtime.tabs[99].sql, '')
    assert.equal(runtime.runs.p0.result, runtime.runs.p0.statements[0].result)
    assert.equal(store.ready('p99'), false)
    runtime.tabs = runtime.tabs.map((tab) => (tab.id === 'p0' ? { ...tab, sql: 'changed draft' } : tab))
    await store.commit(runtime)
    const input = JSON.parse(f.calls.at(-1).body)
    assert.deepEqual(input.drafts, { p0: 'changed draft' })
    assert.deepEqual(input.results, {})
    assert.ok(!f.calls.at(-1).body.includes('9007199254740993'))
    const resultHash = store.page('p0').resultRef
    await store.commit({ ...runtime, resultViews: { p0: { search: 'n', page: 2, resultIndex: 0 } } })
    assert.equal(store.page('p0').resultRef, resultHash)
    const layout = JSON.parse(f.calls.at(-1).body)
    assert.deepEqual(layout.drafts, {})
    assert.deepEqual(layout.results, {})
    const drafts = await store.draft('p99')
    assert.equal(drafts, 'SELECT 99;')
    assert.equal(store.draftsLoaded.has('p99'), false)
  } finally {
    globalThis.fetch = old
  }
})
test('eviction requires successful durability and preserves active/running/dirty pages', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open()
    const a = await store.hydrate('p0')
    const b = await store.hydrate('p1')
    const runtime = store.snapshot({ id: 'p0', ...a })
    runtime.tabs[1] = { ...runtime.tabs[1], sql: b.sql }
    runtime.runs.p1 = b.run
    assert.deepEqual(store.evictable(runtime), ['p1'])
    assert.deepEqual(store.evictable({ ...runtime, runningTabId: 'p1' }), [])
    runtime.tabs[1] = { ...runtime.tabs[1], sql: 'unsaved' }
    assert.deepEqual(store.evictable(runtime), [])
    f.fail()
    await assert.rejects(store.commit(runtime), /冲突|conflict/)
    assert.deepEqual(store.evictable(runtime), [])
    store.forget(['p0'])
    assert.equal(store.savedDrafts.has('p0'), false)
    assert.equal(store.savedResults.has('p0'), false)
  } finally {
    globalThis.fetch = old
  }
})
test('missing/corrupt content does not mark a page ready or overwrite other pages', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open()
    f.parts.delete(store.page('p0').resultRef)
    await assert.rejects(store.hydrate('p0'), /刷新工作区/)
    assert.equal(store.ready('p0'), false)
    const content = await store.hydrate('p1')
    assert.equal(content.sql, 'SELECT 1;')
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    await assert.rejects(store.hydrate('p2', controller.signal), /cancelled/)
    assert.equal(store.ready('p2'), false)
    f.parts.set(store.page('p3').resultRef, { source: 'bad', statements: [{ sql: 42 }] })
    await assert.rejects(store.hydrate('p3'), /损坏/)
    assert.equal(store.ready('p3'), false)
  } finally {
    globalThis.fetch = old
  }
})

test('visiting many tabs releases all inactive draft/result baselines', async () => {
  const old = globalThis.fetch,
    f = fixture()
  globalThis.fetch = f.fetch
  try {
    const store = await WorkspaceStore.open(),
      runtime = store.snapshot()
    for (let i = 0; i < 30; i++) {
      const id = 'p' + i,
        content = await store.hydrate(id)
      runtime.activeTab = id
      runtime.tabs = runtime.tabs.map((tab) => (tab.id === id ? { ...tab, sql: content.sql } : tab))
      runtime.runs[id] = content.run
      const ids = store.evictable(runtime)
      store.forget(ids)
      runtime.tabs = runtime.tabs.map((tab) => (ids.includes(tab.id) ? { ...tab, sql: '' } : tab))
      for (const id of ids) delete runtime.runs[id]
      assert.equal(store.savedDrafts.size, 1)
      assert.equal(store.savedResults.size, 1)
      assert.equal(Object.keys(runtime.runs).length, 1)
    }
    assert.equal(store.page('p0').draftRef.length, 64)
  } finally {
    globalThis.fetch = old
  }
})
