import assert from 'node:assert/strict'
import test from 'node:test'

import { explorerTableIdentity, tableInSchema } from '../src/databases/postgresql/query/index.ts'
import { ObjectAction } from '../src/databases/typings/objectManagement/index.ts'
import { objectNodeKey as key } from '../src/pages/workspace/utils/objectTree/index.ts'
import { explorerAfterChange, findExplorerPage, pagesAfterSchemaChange, queryScopesAfterChange, upsertConnection } from '../src/pages/workspace/utils/workspaceTransitions/index.ts'

test('schema rename updates only matching scopes and clears old tree branches', () => {
  const engine = { tableIdentity: explorerTableIdentity, tableInSchema }
  const tabs = [
    { id: 'q', kind: 'query', connectionId: 'a', database: 'db', schema: 'old.name', table: '"old.name"."t"', sql: 'SELECT * FROM "old.name".t' },
    { id: 'd', kind: 'data', connectionId: 'a', database: 'db', schema: 'old.name', table: '"old.name"."t"' },
    { id: 'other', kind: 'query', connectionId: 'b', database: 'db', schema: 'old.name', table: '' }
  ]
  const target = { connectionId: 'a', database: 'db', schema: 'old.name', table: '' }
  const change = { action: ObjectAction.RenameSchema, target, name: 'new"name' }
  const changed = pagesAfterSchemaChange(tabs, change, engine)
  assert.equal(changed[0].table, '"new""name"."t"')
  assert.equal(changed[0].sql, tabs[0].sql)
  assert.equal(changed[1].schema, 'new"name')
  assert.equal(changed[2], tabs[2])
  const tree = { expanded: [key('schema', 'a', 'db', 'old.name'), key('table', 'a', 'db', '"old.name"."t"'), key('schema', 'b', 'db', 'old.name')], selected: [], search: '', top: 0 }
  assert.deepEqual(explorerAfterChange(tree, change, engine).expanded, [tree.expanded[2]])
  const deleted = pagesAfterSchemaChange(tabs, { ...change, action: ObjectAction.DropSchema }, engine)
  assert.equal(deleted[0].schema, '')
  assert.equal(deleted[1], tabs[1])
})

test('explorer page reuse matches the complete scope and result kind', () => {
  const tabs = [
    { id: 'query', kind: 'query', connectionId: 'a', database: 'db', schema: 's', table: '"s"."t"' },
    { id: 'other-connection', kind: 'data', connectionId: 'b', database: 'db', schema: 's', table: '"s"."t"' },
    { id: 'table', kind: 'data', connectionId: 'a', database: 'db', schema: 's', table: '"s"."t"' },
    { id: 'schema', kind: 'structure', connectionId: 'a', database: 'db', schema: 's', table: '' },
    { id: 'database', kind: 'structure', connectionId: 'a', database: 'db', table: '' }
  ]
  assert.equal(findExplorerPage(tabs, 'data', 'a', 'db', '"s"."t"', 's')?.id, 'table')
  assert.equal(findExplorerPage(tabs, 'structure', 'a', 'db', '', 's')?.id, 'schema')
  assert.equal(findExplorerPage(tabs, 'structure', 'a', 'db', '', '')?.id, 'database')
  assert.equal(findExplorerPage(tabs, 'data', 'a', 'db', '"x"."t"', 'x'), undefined)
})

test('adding a connection appends quietly and creating objects preserves the complete explorer layout', () => {
  const original = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ],
    saved = { id: 'c', name: 'C' }
  assert.deepEqual(upsertConnection(original, saved), [...original, saved])
  assert.equal(original.length, 2)
  const layout = { expanded: [key('group', '其他分组'), key('connection', 'b'), key('database', 'b', 'same')], selected: [key('database', 'b', 'same')], search: '', top: 300 }
  for (const action of [ObjectAction.CreateDatabase, ObjectAction.CreateTable])
    assert.equal(explorerAfterChange(layout, { action, target: { connectionId: 'a', database: 'same', table: '' }, name: 'new' }), layout)
})

test('dropping a database prunes only its own nodes and query scopes, preserving same names elsewhere', () => {
  const expanded = [key('connection', 'a'), key('database', 'a', 'same'), key('table', 'a', 'same', 't'), key('database', 'a', 'other'), key('connection', 'b'), key('database', 'b', 'same')]
  const layout = { expanded, selected: [key('database', 'b', 'same')], search: 'kept', top: 350 }
  const change = { action: ObjectAction.DropDatabase, target: { connectionId: 'a', database: 'same', table: '' }, name: '' }
  const next = explorerAfterChange(layout, change)
  assert.deepEqual(next.expanded, [expanded[0], ...expanded.slice(3)])
  assert.deepEqual(next.selected, layout.selected)
  assert.equal(next.top, 350)
  const tabs = [
    { kind: 'query', connectionId: 'a', database: 'same', table: 't', sql: 'SELECT 1' },
    { kind: 'query', connectionId: 'b', database: 'same', table: 't', sql: 'SELECT 2' },
    { kind: 'query', connectionId: 'a', database: 'other', table: 't', sql: 'SELECT 3' }
  ]
  const changed = queryScopesAfterChange(tabs, change)
  assert.equal(changed[0].database, '')
  assert.equal(changed[0].sql, 'SELECT 1')
  assert.equal(changed[1], tabs[1])
  assert.equal(changed[2], tabs[2])
})
