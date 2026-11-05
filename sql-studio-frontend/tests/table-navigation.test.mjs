import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { ObjectAction } from '../src/databases/typings/objectManagement/index.ts'
import { findExplorerPage } from '../src/pages/workspace/utils/workspaceTransitions/index.ts'
import { WorkspaceStore } from '../src/services/workspace/index.ts'

const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
const pages = source.slice(source.indexOf('  function createPage('), source.indexOf('  function selectConnection('))
const navigation = source.slice(source.indexOf('  function openExplorerPage('), source.indexOf('  const executeSQL = useQueryExecution'))
const implementation = stripTypeScriptTypes(pages + navigation)

function harness(type, view) {
  let tabs = []
  const executions = [],
    targets = [],
    selected = []
  const table = type === 'postgresql' ? '"public"."fixture"' : 'fixture'
  const adapter = {
    objects: {},
    explorer: type === 'postgresql' ? { tableIdentity: () => ({ schema: 'public', name: 'fixture' }) } : undefined,
    tableDataSQL: () => 'SELECT * FROM fixture',
    tableLabel: (name) => name
  }
  const dependencies = {
    ObjectAction,
    findExplorerPage,
    connections: [{ id: 'target', name: 'fixture', type }],
    objects: {
      snapshots: { target: { status: 'connected', tables: { db: [{ name: table, type: view ? 'VIEW' : 'BASE TABLE' }] } } },
      loadStructure: async () => ({ ddl: 'fixture DDL', columns: [] })
    },
    getDatabaseAdapter: () => adapter,
    running: false,
    request: { current: null },
    designerDirty: {},
    activeTab: '',
    tab: { kind: 'query' },
    selectTab: (id) => selected.push(id),
    executeSQL: (sql, scope, id) => executions.push({ sql, scope, id }),
    objectManagement: { open: (action, target) => targets.push({ action, target }) },
    startRun: () => new AbortController(),
    publishResult() {},
    finishRun() {},
    setTabs: (update) => {
      tabs = update(tabs)
    }
  }
  const create = new Function(...Object.keys(dependencies), 'getTabs', 'let tabs = [];\n' + implementation + '\nreturn {tableAction,openExplorerPage,sync:()=>{tabs=getTabs()}}')
  const model = create(...Object.values(dependencies), () => tabs)
  return { model, table, executions, targets, selected, tabs: () => tabs }
}

test('double-clicking tables and views creates a persistable page and a clean execution scope for both engines', async () => {
  const allowed = new Set(['id', 'title', 'kind', 'connectionId', 'database', 'schema', 'table', 'draftRef', 'resultRef', 'interrupted', 'resultStatus', 'resultSource'])
  const original = globalThis.fetch
  try {
    for (const type of ['mysql', 'postgresql'])
      for (const view of [false, true]) {
        const f = harness(type, view)
        f.model.openExplorerPage('data', 'target', 'db', f.table, type === 'postgresql' ? 'public' : undefined)
        assert.equal(f.tabs().length, 1)
        assert.equal(f.executions.length, 1)
        assert.equal(Object.hasOwn(f.tabs()[0], 'view'), false)
        assert.equal(Object.hasOwn(f.executions[0].scope, 'view'), false)
        f.model.sync()
        f.model.openExplorerPage('data', 'target', 'db', f.table, type === 'postgresql' ? 'public' : undefined)
        assert.equal(f.tabs().length, 1)
        assert.equal(f.executions.length, 2)
        const store = new WorkspaceStore({
          revision: 1,
          index: {
            version: 2,
            tabs: [],
            activeTab: '',
            runningTabId: '',
            resultViews: {},
            editorLayouts: {},
            explorer: { expanded: [], selected: [], search: '', top: 0 },
            resultHeight: 260,
            openedConnections: []
          }
        })
        let commits = 0
        globalThis.fetch = async (_url, options) => {
          const body = JSON.parse(options.body)
          for (const page of body.index.tabs) {
            assert.ok(
              Object.keys(page).every((key) => allowed.has(key)),
              'page must match the backend WorkspacePage contract'
            )
            page.draftRef = 'a'.repeat(64)
          }
          commits++
          return new Response(JSON.stringify({ revision: 2, index: body.index }))
        }
        await store.commit({ ...store.snapshot(), tabs: f.tabs(), activeTab: f.tabs()[0].id })
        assert.equal(commits, 1)
        assert.equal(store.doc.revision, 2)
      }
  } finally {
    globalThis.fetch = original
  }
})

test('query, structure, DDL and designer pages exclude object-management metadata', async () => {
  for (const type of ['mysql', 'postgresql'])
    for (const action of ['new', 'structure', 'ddl', 'design', 'create']) {
      const f = harness(type, false)
      await f.model.tableAction(action, 'target', 'db', f.table)
      assert.equal(f.tabs().length, 1)
      assert.equal(Object.hasOwn(f.tabs()[0], 'view'), false)
      assert.equal(f.tabs()[0].connectionId, 'target')
    }
})

test('object management retains the view flag for table-versus-view operations', async () => {
  for (const type of ['mysql', 'postgresql'])
    for (const view of [false, true]) {
      const f = harness(type, view)
      await f.model.tableAction('delete', 'target', 'db', f.table)
      assert.equal(f.targets[0].action, ObjectAction.DropTable)
      assert.equal(f.targets[0].target.view, view)
      assert.equal(f.tabs().length, 0)
    }
})
