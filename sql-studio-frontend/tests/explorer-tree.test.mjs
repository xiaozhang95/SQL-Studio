import assert from 'node:assert/strict'
import test from 'node:test'

import { buildExplorerTree } from '../src/pages/workspace/utils/explorerTree/index.ts'
import { objectNodeKey as key } from '../src/pages/workspace/utils/objectTree/index.ts'

const connections = [
  { id: 'a', name: 'A', group: '默认分组', host: 'fixture', port: 3306 },
  { id: 'b', name: 'B', group: '默认分组', host: 'fixture', port: 3306 }
]
const tables = Array.from({ length: 10000 }, (_, index) => ({ name: `t_${String(index).padStart(5, '0')}`, type: 'BASE TABLE', comment: '' }))
const snapshot = { status: 'connected', databases: ['big'], tables: { big: tables }, loadingTables: [], tableErrors: {}, details: {}, structures: {}, detailErrors: {}, error: '' }
const snapshots = { a: snapshot, b: { ...snapshot, tables: { big: [] } } }

test('ten thousand cached tables do not create descendants under collapsed categories or groups', () => {
  const expanded = [key('group', '默认分组'), key('connection', 'a'), key('database', 'a', 'big')]
  const closed = buildExplorerTree(connections, snapshots, expanded, '')
  assert.ok(closed.byKey.size < 10)
  const open = buildExplorerTree(connections, snapshots, [...expanded, key('tables', 'a', 'big')], '')
  assert.equal([...open.byKey.values()].filter((node) => node.kind === 'table').length, 10000)
  assert.ok([...open.byKey.values()].every((node) => typeof node.title === 'string'))
  const hidden = buildExplorerTree(
    connections,
    snapshots,
    expanded.filter((value) => value !== key('group', '默认分组')),
    ''
  )
  assert.equal([...hidden.byKey.values()].filter((node) => node.kind === 'table').length, 0)
  assert.equal(expanded.length, 3)
})

test('cached columns and indexes are constructed only when their own group is expanded', () => {
  const table = 't_00000'
  const state = {
    ...snapshot,
    details: {
      [key('big', table)]: {
        columns: [{ name: 'id', type: 'bigint', key: 'PRI', comment: '' }],
        indexes: [{ name: 'PRIMARY', unique: true, type: 'BTREE', columns: [{ name: 'id', position: 1, prefixLength: null, order: 'A' }] }]
      }
    }
  }
  const expanded = [key('group', '默认分组'), key('connection', 'a'), key('database', 'a', 'big'), key('tables', 'a', 'big'), key('table', 'a', 'big', table)]
  const groups = buildExplorerTree(connections, { a: state }, expanded, '')
  assert.equal(
    [...groups.byKey.values()].some((node) => node.kind === 'column' || node.kind === 'index'),
    false
  )
  const fields = buildExplorerTree(connections, { a: state }, [...expanded, key('columns', 'a', 'big', table)], '')
  assert.equal(fields.byKey.get(key('column', 'a', 'big', table, 'id')).primary, true)
  assert.equal(
    [...fields.byKey.values()].some((node) => node.kind === 'index'),
    false
  )
})

test('scroll restoration waits for expanded connection and database lists to finish loading', () => {
  const expanded = [key('group', '默认分组'), key('connection', 'a'), key('database', 'a', 'big')]
  assert.equal(buildExplorerTree(connections, {}, expanded, '').ready, false)
  assert.equal(buildExplorerTree(connections, { a: { ...snapshot, tables: {} } }, expanded, '').ready, false)
  assert.equal(buildExplorerTree(connections, snapshots, expanded, '').ready, true)
  const tableExpanded = [...expanded, key('tables', 'a', 'big'), key('table', 'a', 'big', 't_00000')]
  assert.equal(buildExplorerTree(connections, snapshots, tableExpanded, '').ready, false)
  const withDetails = { ...snapshot, details: { [key('big', 't_00000')]: { columns: [], indexes: [] } } }
  assert.equal(buildExplorerTree(connections, { a: withDetails, b: snapshots.b }, tableExpanded, '').ready, true)
})
