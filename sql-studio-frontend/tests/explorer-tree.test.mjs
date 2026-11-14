import assert from 'node:assert/strict'
import test from 'node:test'

import { explorerTableIdentity } from '../src/databases/postgresql/query/index.ts'
import { buildExplorerTree, explorerQueryScope } from '../src/pages/workspace/utils/explorerTree/index.ts'
import { objectNodeKey as key } from '../src/pages/workspace/utils/objectTree/index.ts'

test('shared groups include empty folders, deduplicate member groups and filter empty folders by search', () => {
  const connection = { id: 'group-member', name: '开发连接', group: '开发', type: 'mysql', host: 'localhost', port: 3306, username: 'test' }
  const groups = ['默认分组', '开发', '空分组']
  const tree = buildExplorerTree([connection], {}, [], '', {}, groups)
  assert.deepEqual(
    tree.nodes.map((node) => node.title),
    groups
  )
  assert.equal(tree.nodes[1].children[0].owner, 'group-member')
  assert.deepEqual(tree.nodes[2].children, [])
  assert.equal(explorerQueryScope(tree.nodes[2], true), undefined)
  const searched = buildExplorerTree([], {}, [], '空', {}, groups)
  assert.deepEqual(
    searched.nodes.map((node) => node.title),
    ['空分组']
  )
  const empty = buildExplorerTree([], {}, [], '', {}, groups)
  assert.equal(empty.nodes.length, 3)
})

const connections = [
  { id: 'a', name: 'A', group: '默认分组', host: 'fixture', port: 3306 },
  { id: 'b', name: 'B', group: '默认分组', host: 'fixture', port: 3306 }
]
const tables = Array.from({ length: 10000 }, (_, index) => ({ name: `t_${String(index).padStart(5, '0')}`, type: 'BASE TABLE', comment: '' }))
const snapshot = { status: 'connected', databases: ['big'], tables: { big: tables }, loadingTables: [], tableErrors: {}, details: {}, structures: {}, detailErrors: {}, error: '' }
const snapshots = { a: snapshot, b: { ...snapshot, tables: { big: [] } } }

test('database state follows successful opening, not connection status or expansion, and honors explicit close', () => {
  const expanded = [key('group', '默认分组'), key('connection', 'a')]
  const node = (state, closed = {}) => buildExplorerTree(connections.slice(0, 1), { a: state }, expanded, '', {}, [], closed).byKey.get(key('database', 'a', 'big'))
  assert.equal(node({ ...snapshot, tables: {} }).databaseState, 'closed')
  assert.match(node({ ...snapshot, tables: {} }).tooltip, /未打开/)
  assert.equal(node({ ...snapshot, tables: {}, loadingTables: ['big'] }).databaseState, 'opening')
  assert.equal(node({ ...snapshot, tables: { big: [] } }).databaseState, 'open')
  assert.equal(node(snapshot).databaseState, 'open')
  assert.equal(node(snapshot, { a: ['big'] }).databaseState, 'closed')
  assert.equal(node({ ...snapshot, tableErrors: { big: 'permission denied' } }).databaseState, 'error')
  assert.match(node({ ...snapshot, tableErrors: { big: 'permission denied' } }).tooltip, /permission denied/)
  assert.ok(!expanded.includes(key('database', 'a', 'big')))
})

test('new query scope follows selected database or schema, never an unrelated page', () => {
  const layout = { tableIdentity: explorerTableIdentity }
  assert.equal(explorerQueryScope(undefined, true, layout), undefined)
  assert.deepEqual(explorerQueryScope({ kind: 'connection', owner: 'a', database: '', table: '' }, true, layout), { connectionId: 'a', database: '', table: '' })
  assert.equal(explorerQueryScope({ kind: 'connection', owner: 'a', database: '', table: '' }, false, layout), undefined)
  assert.equal(explorerQueryScope({ kind: 'database', owner: 'a', database: 'db', table: '' }, false, layout), undefined)
  assert.deepEqual(explorerQueryScope({ kind: 'database', owner: 'a', database: 'db', table: '' }, true, layout), { connectionId: 'a', database: 'db', table: '' })
  assert.deepEqual(explorerQueryScope({ kind: 'schema', owner: 'a', database: 'db', schema: 'x.y', table: '' }, true, layout), { connectionId: 'a', database: 'db', schema: 'x.y', table: '' })
  assert.deepEqual(explorerQueryScope({ kind: 'table', owner: 'a', database: 'db', table: '"x.y"."t"' }, true, layout), { connectionId: 'a', database: 'db', schema: 'x.y', table: '' })
})

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

test('foreign key nodes preserve column mapping and distinguish unsupported and empty metadata', () => {
  const table = 't_00000'
  const groupKey = key('foreign-keys', 'a', 'big', table)
  const detailKey = key('big', table)
  const expanded = [key('group', '默认分组'), key('connection', 'a'), key('database', 'a', 'big'), key('tables', 'a', 'big'), key('table', 'a', 'big', table), groupKey]
  const render = (foreignKeys, foreignKeyError) =>
    buildExplorerTree(connections, { a: { ...snapshot, details: { [detailKey]: { columns: [], indexes: [], foreignKeys, foreignKeyError } } } }, expanded, '').byKey

  assert.equal(render(undefined).has(groupKey), false)
  assert.deepEqual(render([]).get(groupKey).children, [])
  const failed = render(undefined, '外键加载失败')
  assert.equal(failed.get(groupKey).children[0].retry, 'table')
  assert.ok(failed.has(key('columns', 'a', 'big', table)))
  const nodes = render([
    {
      name: 'fk_order',
      referencedSchema: 'qa_parent',
      referencedTable: 'source_keys',
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      columns: [
        { name: 'z', referencedName: 'beta' },
        { name: 'a', referencedName: 'alpha' }
      ]
    }
  ])
  const leaf = nodes.get(key('foreign-key', 'a', 'big', table, 'fk_order'))
  assert.equal(leaf.tooltip, 'fk_order\n(z, a) → qa_parent.source_keys (beta, alpha)\nON UPDATE CASCADE\nON DELETE SET NULL')
  assert.deepEqual(explorerQueryScope(leaf, true), { connectionId: 'a', database: 'big', table: '' })
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

test('PostgreSQL shows database/schema/category/table and preserves full action identities', () => {
  const rows = [
    { name: '"a.b"."same"', type: 'BASE TABLE', comment: '' },
    { name: '"other"."same"', type: 'BASE TABLE', comment: '' },
    { name: '"other"."view_name"', type: 'VIEW', comment: '' }
  ]
  const state = { ...snapshot, schemas: { big: ['a.b', 'other', 'empty'] }, tables: { big: rows } }
  const initial = [key('group', '默认分组'), key('connection', 'a'), key('database', 'a', 'big')]
  const layout = { a: { tableIdentity: explorerTableIdentity } }
  const closed = buildExplorerTree(connections, { a: state }, initial, '', layout)
  assert.deepEqual(
    closed.byKey.get(key('database', 'a', 'big')).children.map((node) => node.title),
    ['a.b', 'empty', 'other']
  )
  assert.equal(
    [...closed.byKey.values()].some((node) => node.kind === 'table'),
    false
  )
  const expanded = [
    ...initial,
    key('schema', 'a', 'big', 'a.b'),
    key('schema', 'a', 'big', 'other'),
    key('schema', 'a', 'big', 'empty'),
    key('tables', 'a', 'big', 'a.b'),
    key('tables', 'a', 'big', 'other'),
    key('tables', 'a', 'big', 'empty'),
    key('views', 'a', 'big', 'other')
  ]
  const tree = buildExplorerTree(connections, { a: state }, expanded, '', layout)
  const first = tree.byKey.get(key('table', 'a', 'big', '"a.b"."same"'))
  const second = tree.byKey.get(key('table', 'a', 'big', '"other"."same"'))
  assert.equal(first.title, 'same')
  assert.equal(second.title, 'same')
  assert.notEqual(first.key, second.key)
  assert.equal(first.table, '"a.b"."same"')
  assert.equal(second.owner, 'a')
  assert.equal(tree.byKey.get(key('tables', 'a', 'big', 'empty')).children[0].title, '暂无表')
  assert.equal(tree.byKey.get(key('views', 'a', 'big', 'other')).children[0].title, 'view_name')
  assert.equal(new Set(tree.byKey.keys()).size, tree.byKey.size)
  const search = buildExplorerTree(connections, { a: state }, expanded, 'empty', layout)
  assert.equal(search.byKey.get(key('database', 'a', 'big')).children[0].title, 'empty')
})
