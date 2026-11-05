import assert from 'node:assert/strict'
import test from 'node:test'

import { queryPageContext, workspacePageTitle } from '../src/pages/workspace/utils/pageTitle/index.ts'

const page = { id: 'one', kind: 'query', title: '查询 1', database: 'sql_studio_demo', sql: 'SELECT 1' }

test('查询标题跟随所属页面切库，清空范围恢复原名且不修改保存标题', () => {
  assert.equal(workspacePageTitle(page), 'sql_studio_demo · 查询 1')
  const changed = { ...page, database: 'other_db' }
  assert.equal(workspacePageTitle(changed), 'other_db · 查询 1')
  assert.equal(workspacePageTitle({ ...changed, database: '' }), '查询 1')
  assert.equal(workspacePageTitle(page), 'sql_studio_demo · 查询 1')
  assert.equal(page.title, '查询 1')
  assert.equal(changed.title, '查询 1')
  assert.equal(changed.sql, page.sql)
})

test('多页和恢复后的标题各自派生，旧执行来源及导入文件名不被覆盖', () => {
  const pages = [page, { ...page, id: 'two', title: 'report.sql', database: '财务 / 报表', resultSource: 'old-connection / old-db' }]
  const restored = JSON.parse(JSON.stringify(pages))
  assert.deepEqual(restored.map(workspacePageTitle), ['sql_studio_demo · 查询 1', '财务 / 报表 · report.sql'])
  assert.deepEqual(restored, pages)
  restored[1].database = 'warehouse'
  assert.deepEqual(restored.map(workspacePageTitle), ['sql_studio_demo · 查询 1', 'warehouse · report.sql'])
  assert.equal(restored[1].title, 'report.sql')
})

test('Schema 随查询页范围展示，对象和设计页保持现有标题', () => {
  assert.equal(queryPageContext({ ...page, schema: 'public' }), 'sql_studio_demo / public')
  assert.equal(workspacePageTitle({ ...page, schema: 'private' }), 'sql_studio_demo / private · 查询 1')
  assert.equal(queryPageContext({ ...page, database: '', schema: 'public' }), '')
  for (const kind of ['data', 'structure', 'ddl', 'table-create', 'table-design']) {
    const objectPage = { ...page, kind, title: 'customers · 数据', schema: 'public' }
    assert.equal(queryPageContext(objectPage), '')
    assert.equal(workspacePageTitle(objectPage), objectPage.title)
  }
})
