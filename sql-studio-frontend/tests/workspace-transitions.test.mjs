import assert from 'node:assert/strict'
import test from 'node:test'

import { ObjectAction } from '../src/databases/typings/objectManagement/index.ts'
import { objectNodeKey as key } from '../src/pages/workspace/utils/objectTree/index.ts'
import { explorerAfterChange, queryScopesAfterChange, upsertConnection } from '../src/pages/workspace/utils/workspaceTransitions/index.ts'

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
