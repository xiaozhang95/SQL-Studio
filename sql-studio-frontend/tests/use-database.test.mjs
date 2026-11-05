import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { splitSQLStatements, useDatabaseSQL } from '../src/databases/mysql/statements/index.ts'

// 执行真实工作区编排函数，替换请求与 React 状态；不连接业务数据库。
const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
const executionSource = readFileSync(new URL('../src/pages/workspace/hooks/useQueryExecution/index.ts', import.meta.url), 'utf8')
const implementation = executionSource.slice(executionSource.indexOf('  async function executeSQL('), executionSource.indexOf('  return executeSQL'))
async function run(script, failSQL, cancelSQL, schema, kind = 'query') {
  const controller = new AbortController()
  const calls = [],
    histories = [],
    results = []
  let pages = [
    { id: 'page', kind: 'query', connectionId: 'a', database: '', table: '' },
    { id: 'other', kind: 'query', connectionId: 'a', database: 'kept', table: 't' }
  ]
  const dependencies = {
    connections: [{ id: 'a', name: 'fixture', type: schema ? 'postgresql' : 'mysql' }],
    objects: { snapshots: { a: { status: 'connected' } } },
    running: false,
    request: { current: null },
    getDatabaseAdapter: () => ({ splitStatements: splitSQLStatements, useDatabase: useDatabaseSQL, tableLabel: (table) => table }),
    message: { error() {}, info() {}, success() {} },
    startRun: () => controller,
    finishRun() {},
    executeQuery: async (id, input) => {
      calls.push({ id, ...input })
      if (input.sql === cancelSQL) controller.abort()
      if (input.sql === failSQL) throw new Error('denied')
      return { isQuery: true, durationMs: 1 }
    },
    setTabs: (update) => {
      pages = update(pages)
    },
    appendHistory: (item) => histories.push(item),
    publishResult: (_, result) => results.push(result),
    setResultViews() {}
  }
  const execute = new Function(...Object.keys(dependencies), stripTypeScriptTypes(implementation) + '; return executeSQL')(...Object.values(dependencies))
  await execute(script, { connectionId: 'a', database: '', schema, table: '' }, 'page', kind)
  return { calls, histories, results, pages }
}

test('successful USE propagates to subsequent requests and only the originating page', async () => {
  const output = await run('USE first; SELECT 1; USE `second db`; SELECT 2;')
  assert.deepEqual(
    output.calls.map(({ database }) => database),
    ['', 'first', 'first', 'second db']
  )
  assert.deepEqual(
    output.histories.map(({ database }) => database),
    ['', 'first', 'first', 'second db']
  )
  assert.deepEqual(
    output.results.at(-1).statements.map(({ database }) => database),
    ['', 'first', 'first', 'second db']
  )
  assert.equal(output.pages[0].database, 'second db')
  assert.equal(output.pages[1].database, 'kept')
  assert.ok(output.calls.every(({ id }) => id === 'a'))
})

test('failed USE stops the batch and retains the last successful scope', async () => {
  const output = await run('USE first; USE denied; SELECT 1;', 'USE denied;')
  assert.equal(output.calls.length, 2)
  assert.equal(output.pages[0].database, 'first')
  assert.match(output.results.at(-1).statements[1].error, /后续 1 条语句未执行/)
})

test('cancelled USE retains scope and stops subsequent statements', async () => {
  const output = await run('USE first; SELECT 1;', undefined, 'USE first;')
  assert.equal(output.calls.length, 1)
  assert.equal(output.pages[0].database, '')
  assert.match(output.results[0].statements[0].error, /请求已取消/)
})

test('schema follows the originating batch into requests, histories and refresh records', async () => {
  const output = await run('SELECT 1; SELECT 2;', undefined, undefined, 'cron')
  assert.ok(output.calls.every((call) => call.schema === 'cron'))
  assert.ok(output.histories.every((item) => item.schema === 'cron'))
  assert.ok(output.results.at(-1).statements.every((item) => item.schema === 'cron'))
})

test('refresh reuses the executed statement schema instead of the current selector', async () => {
  const start = source.indexOf('  async function refreshResult()')
  const code = source.slice(start, source.indexOf('  function executeCurrentSQL', start))
  const calls = []
  const deps = {
    running: false,
    canRefreshResult: true,
    refreshScope: { connectionId: 'a', database: 'batch-db', schema: 'batch-schema', table: '' },
    tab: { id: 'query', kind: 'query', database: 'changed-db', schema: 'changed-schema' },
    statementRun: { sql: 'SELECT 1', database: 'executed-db', schema: 'executed-schema' },
    executeSQL: (...args) => calls.push(args)
  }
  const refresh = new Function(...Object.keys(deps), stripTypeScriptTypes(code) + ';return refreshResult')(...Object.values(deps))
  await refresh()
  assert.equal(calls[0][1].database, 'executed-db')
  assert.equal(calls[0][1].schema, 'executed-schema')
})

test('both SQL windows explicitly enable DDL and DML execution', async () => {
  const pg = await run('CREATE SCHEMA sample; INSERT INTO sample.t VALUES (1);', undefined, undefined, 'public')
  assert.ok(pg.calls.every((call) => call.allowWrite === true))
  const mysql = await run('SET NAMES utf8mb4; CREATE TABLE sample(id INT); INSERT INTO sample VALUES(1);')
  assert.equal(mysql.calls.length, 3)
  assert.ok(mysql.calls.every((call) => call.allowWrite === true))
})

test('table data previews retain the default read request', async () => {
  const output = await run('SELECT * FROM sample;', undefined, undefined, undefined, 'data')
  assert.equal(output.calls.length, 1)
  assert.equal(output.calls[0].allowWrite, undefined)
  assert.equal(output.histories.length, 0)
})
