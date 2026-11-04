import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import ts from 'typescript'

import { DatabaseLifecycle } from '../src/pages/workspace/utils/databaseLifecycle/index.ts'
import { buildExplorerTree } from '../src/pages/workspace/utils/explorerTree/index.ts'

const read = (path) => readFileSync(new URL('../src/pages/workspace/' + path, import.meta.url), 'utf8')
const source = read('hooks/useDatabaseObjects/index.ts')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('type TableStructure')).replace('export function', 'function'))
const workspace = read('hooks/useWorkspace/index.tsx')
const opened = workspace.slice(workspace.indexOf('  const openedKey ='), workspace.indexOf('  const snapshot ='))
const openedConnections = new Function('objects', 'useMemo', stripTypeScriptTypes(opened) + ';return openedConnections')
const savedConnections = (model) => openedConnections(model, (factory) => factory())

function harness(sessionRequest) {
  const slots = []
  const cleanups = []
  const calls = []
  let cursor = 0
  const slot = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return index
  }
  const dependencies = {
    useState: (initial) => {
      const index = slot(initial)
      return [slots[index], (value) => (slots[index] = typeof value === 'function' ? value(slots[index]) : value)]
    },
    useRef: (initial) => slots[slot({ current: initial })],
    useEffect: (effect) => {
      const index = cursor++
      if (!(index in slots)) {
        slots[index] = true
        cleanups.push(effect())
      }
    },
    useCallback: (callback) => callback,
    DatabaseLifecycle,
    setConnectionSession: async (...args) => {
      calls.push(args)
      return sessionRequest(...args)
    },
    getDatabases: async () => ['fixture']
  }
  const create = new Function(...Object.keys(dependencies), implementation + ';return useDatabaseObjects')(...Object.values(dependencies))
  return {
    calls,
    render: () => {
      cursor = 0
      return create('offline', '', () => {}, [])
    },
    unmount: () => cleanups.forEach((cleanup) => cleanup?.())
  }
}

function connectionMenu(status, running = false) {
  const component = read('components/databaseExplorer/index.tsx')
  const code = component.slice(component.indexOf('  function menuFor('), component.indexOf('  function icon('))
  const implementation = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText
  const actions = []
  const dependencies = {
    React: { createElement: () => null },
    ...Object.fromEntries(['PlusOutlined', 'CloseOutlined', 'LinkOutlined', 'EditOutlined', 'FolderOutlined', 'DeleteOutlined', 'ReloadOutlined'].map((name) => [name, name])),
    connections: [{ id: 'offline' }],
    objects: { snapshots: status ? { offline: { status } } : {}, closedDatabases: {} },
    getDatabaseAdapter: () => ({ objects: {} }),
    canExportDatabase: () => false,
    connectionGroups: { groups: [], blocked: false },
    running,
    setMenuOpen() {},
    model: { connectionAction: (...args) => actions.push(args) }
  }
  const menuFor = new Function(...Object.keys(dependencies), implementation + ';return menuFor')(...Object.values(dependencies))
  return { menu: menuFor({ kind: 'connection', owner: 'offline' }), actions }
}

test('failed restore is excluded from saved open connections and can be closed without reopening the database', async () => {
  const h = harness(async (id, open) => {
    if (id === 'offline' && open) throw new Error('connection refused')
  })
  await h.render().openConnection('other')
  await assert.rejects(h.render().openConnection('offline'), /connection refused/)
  assert.equal(h.render().snapshots.offline.status, 'error')
  assert.deepEqual(savedConnections(h.render()), ['other'])
  const { menu, actions } = connectionMenu('error')
  assert.ok(menu.items.some((item) => item.key === 'open'))
  assert.ok(menu.items.some((item) => item.key === 'close'))
  menu.onClick({ key: 'close', domEvent: { stopPropagation() {} } })
  assert.deepEqual(actions, [['close', 'offline']])
  const other = h.render().snapshots.other
  await h.render().closeConnection('offline')
  assert.equal(h.render().snapshots.offline, undefined)
  assert.equal(h.render().snapshots.other, other)
  assert.deepEqual(h.calls.at(-1), ['offline', false])
  assert.deepEqual(savedConnections(h.render()), ['other'])
  h.unmount()
})

test('manual retry after failure is saved only after a successful connection', async () => {
  let online = false
  const h = harness(async (_id, open) => {
    if (open && !online) throw new Error('offline')
  })
  await assert.rejects(h.render().openConnection('offline'), /offline/)
  assert.deepEqual(savedConnections(h.render()), [])
  online = true
  await h.render().openConnection('offline')
  assert.equal(h.render().snapshots.offline.status, 'connected')
  assert.deepEqual(savedConnections(h.render()), ['offline'])
  h.unmount()
})

test('closing a pending connection aborts it and late responses cannot restore the saved open flag', async () => {
  let complete
  const h = harness((_id, open) => (open ? new Promise((resolve) => (complete = resolve)) : Promise.resolve()))
  const pending = h.render().openConnection('offline')
  assert.deepEqual(savedConnections(h.render()), [])
  assert.equal(h.render().snapshots.offline.status, 'loading')
  const signal = h.calls[0][3]
  await h.render().closeConnection('offline')
  assert.equal(signal.aborted, true)
  complete()
  await pending
  assert.equal(h.render().snapshots.offline, undefined)
  assert.deepEqual(savedConnections(h.render()), [])
  h.unmount()
})

test('failed close retains the error node and a close action for retry', async () => {
  const h = harness(async (_id, open) => {
    throw new Error(open ? 'database offline' : 'close request failed')
  })
  await assert.rejects(h.render().openConnection('offline'), /database offline/)
  await assert.rejects(h.render().closeConnection('offline'), /close request failed/)
  assert.equal(h.render().snapshots.offline.status, 'error')
  assert.deepEqual(
    connectionMenu('error', true).menu.items.map((item) => item.key),
    ['close']
  )
  assert.deepEqual(savedConnections(h.render()), [])
  h.unmount()
})

test('closed, loading and connected nodes retain their existing open or close actions', () => {
  for (const [status, expected] of [
    [undefined, ['open']],
    ['loading', ['close']],
    ['connected', ['close']]
  ]) {
    const { menu } = connectionMenu(status)
    assert.deepEqual(
      menu.items.filter((item) => item.key === 'open' || item.key === 'close').map((item) => item.key),
      expected
    )
  }
})

test('expanded failure nodes finish Tree loading and retain an explicit retry without becoming connected', async () => {
  const h = harness(async () => {
    throw new Error('connection refused')
  })
  await assert.rejects(h.render().openConnection('offline'), /connection refused/)
  const group = JSON.stringify(['group', '默认分组'])
  const root = JSON.stringify(['connection', 'offline'])
  const tree = buildExplorerTree([{ id: 'offline', name: 'fixture', host: 'fixture', port: 5432 }], h.render().snapshots, [group, root], '')
  assert.ok(tree.loadedKeys.includes(root))
  assert.equal(tree.byKey.get(root).status, 'is-error')
  assert.equal(tree.byKey.get(root).children[0].retry, 'connection')
  assert.deepEqual(savedConnections(h.render()), [])
  h.unmount()
})

test('restoring a closed or failed connection does not let old expansion records reopen it', () => {
  const start = workspace.indexOf('      const restoredConnectionIds =')
  const code = workspace.slice(start, workspace.indexOf('      setResultHeight(', start))
  const restore = new Function('saved', 'setExplorer', stripTypeScriptTypes(code))
  const key = (...parts) => JSON.stringify(parts)
  const group = key('group', '默认分组')
  const connected = key('connection', 'other')
  const database = key('database', 'other', 'db')
  const failed = key('connection', 'offline')
  const failedDatabase = key('database', 'offline', 'db')
  const saved = {
    openedConnections: ['other'],
    explorer: { expanded: [group, failed, failedDatabase, connected, database], selected: [failed], search: '', top: 120 }
  }
  let restored
  restore(saved, (value) => (restored = value))
  assert.deepEqual(restored.expanded, [group, connected, database])
  assert.deepEqual(restored.selected, [failed])
  assert.equal(restored.top, 120)
  assert.equal(saved.explorer.expanded.length, 5)
})
