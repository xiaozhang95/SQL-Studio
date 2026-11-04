import assert from 'node:assert/strict'
import test from 'node:test'

import { reconcileWorkspacePages } from '../src/pages/workspace/utils/workspacePages/index.ts'

const page = { id: 'a', kind: 'query', title: '查询', connectionId: 'one', database: 'db', schema: 'old', table: 'old.t', sql: 'SELECT 1' }
const identity = (value) => value

test('未知schema列表不清空；已知空列表只清空目标查询范围且校正幂等', () => {
  const pages = [page, { ...page, id: 'b', connectionId: 'two' }, { ...page, id: 'c', kind: 'data' }]
  const unknown = { validateSchemas: true, snapshots: { one: {} }, present: identity }
  assert.equal(reconcileWorkspacePages(pages, unknown), pages)
  const options = { ...unknown, snapshots: { one: { schemas: { db: [] } } } }
  const result = reconcileWorkspacePages(pages, options)
  assert.equal(result[0].schema, '')
  assert.equal(result[0].table, '')
  assert.equal(result[0].sql, page.sql)
  assert.equal(result[1], pages[1])
  assert.equal(result[2], pages[2])
  assert.equal(page.schema, 'old')
  assert.equal(reconcileWorkspacePages(result, options), result)
})

test('对象操作期间暂停校验，有效schema保持原数组', () => {
  const pages = [page]
  const options = { validateSchemas: false, snapshots: { one: { schemas: { db: [] } } }, present: identity }
  assert.equal(reconcileWorkspacePages(pages, options), pages)
  assert.equal(reconcileWorkspacePages(pages, { ...options, validateSchemas: true, snapshots: { one: { schemas: { db: ['old'] } } } }), pages)
})

test('显示迁移与schema校验一次完成，不改SQL与连接；再次计算无更新', () => {
  const pages = [page]
  const options = {
    validateSchemas: true,
    snapshots: { one: { schemas: { db: [] } } },
    present: (value) => (value.title === '已迁移' ? value : { ...value, title: '已迁移' })
  }
  const result = reconcileWorkspacePages(pages, options)
  assert.equal(result[0].title, '已迁移')
  assert.equal(result[0].schema, '')
  assert.equal(result[0].connectionId, page.connectionId)
  assert.equal(result[0].sql, page.sql)
  assert.equal(reconcileWorkspacePages(result, options), result)
})
