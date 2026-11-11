import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import ts from 'typescript'

import { indexDescription, objectNodeKey } from '../src/pages/workspace/utils/objectTree/index.ts'

const explorerSource = ts.createSourceFile(
  'databaseExplorer.tsx',
  readFileSync(new URL('../src/pages/workspace/components/databaseExplorer/index.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)

// 执行组件实际传给 Tree 的回调，页面操作和布局更新分别记录。
function treeHandler(name, dependencies) {
  let expression
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(explorerSource) === name && node.initializer && ts.isJsxExpression(node.initializer)) expression = node.initializer.expression
    ts.forEachChild(node, visit)
  }
  visit(explorerSource)
  assert.ok(expression, '缺少 Tree 回调: ' + name)
  const compiled = ts.transpileModule('const handler = ' + expression.getText(explorerSource), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(...Object.keys(dependencies), compiled + '\nreturn handler')(...Object.values(dependencies))
}

test('数据库及分类节点双击不打开或刷新页面，展开和折叠只更新布局', () => {
  for (const kind of ['database', 'tables', 'views', 'columns', 'indexes']) {
    const node = { kind, key: objectNodeKey(kind, 'connection-a', 'fixture'), owner: 'connection-a', database: 'fixture', table: '' }
    const calls = []
    let expanded = []
    const dependencies = {
      running: false,
      data: { byKey: new Map([[node.key, node]]) },
      model: { openExplorerPage: (...args) => calls.push(args) },
      connections: [],
      getDatabaseAdapter: () => assert.fail('数据库和分类节点不应进入页面操作的适配器'),
      updateExplorer: (next) => {
        expanded = next.expanded
      }
    }
    const doubleClick = treeHandler('onDoubleClick', dependencies)
    for (const opening of [true, false]) {
      doubleClick({}, { ...node, isLeaf: false, expanded: !opening })
      treeHandler('onExpand', { ...dependencies, expanded })([], { node, expanded: opening })
      assert.deepEqual(expanded, opening ? [node.key] : [])
      assert.deepEqual(calls, [], kind + ' 节点不能打开、切换或刷新页面')
    }
  }
})

test('Schema 与表数据的双击入口继续按原始目标调用，折叠不打开页面', () => {
  const calls = []
  for (const kind of ['schema', 'table']) {
    const node = { kind, key: kind, owner: 'connection-a', database: 'fixture', schema: 'public', table: 'public.example' }
    const doubleClick = treeHandler('onDoubleClick', {
      running: false,
      data: { byKey: new Map([[node.key, node]]) },
      model: { openExplorerPage: (...args) => calls.push(args) },
      connections: [{ id: 'connection-a', type: 'postgresql' }],
      getDatabaseAdapter: () => ({ explorer: { tableIdentity: () => ({ schema: 'public' }) } })
    })
    doubleClick({}, { key: node.key, isLeaf: false, expanded: true })
    assert.equal(calls.length, 0)
    doubleClick({}, { key: node.key, isLeaf: false, expanded: false })
    assert.deepEqual(calls.pop(), [kind === 'table' ? 'data' : 'structure', 'connection-a', 'fixture', kind === 'table' ? 'public.example' : '', 'public'])
  }
})

test('tree keys preserve explicit scope and names containing separators', () => {
  const key = objectNodeKey('index', 'connection-a', 'shared.db', 'a/b', 'idx_"value')
  assert.deepEqual(JSON.parse(key), ['index', 'connection-a', 'shared.db', 'a/b', 'idx_"value'])
  assert.notEqual(key, objectNodeKey('index', 'connection-b', 'shared.db', 'a/b', 'idx_"value'))
})

test('index description retains composite order, prefix, direction and unknown expression', () => {
  const index = {
    name: 'idx_user_date',
    type: 'BTREE',
    unique: false,
    columns: [
      { name: 'bill_date', position: 2, prefixLength: 12, order: 'D' },
      { name: 'user_id', position: 1, prefixLength: null, order: 'A' }
    ]
  }
  assert.equal(indexDescription(index), '普通索引 · BTREE\nuser_id, bill_date(12) DESC')
  assert.equal(index.columns[0].name, 'bill_date')
  assert.match(indexDescription({ ...index, name: 'PRIMARY', unique: true }), /^主键/)
  assert.equal(indexDescription({ name: 'unique_expression', type: 'BTREE', unique: true, columns: [{ name: '', position: 1, prefixLength: null, order: '' }] }), '唯一索引 · BTREE\n(表达式)')
})
