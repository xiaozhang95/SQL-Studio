import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultOutputView, resultOutputs, statementOutputs } from '../src/pages/workspace/utils/queryOutput/index.ts'

const result = (columns = [], rows = [], affectedRows = 1) => ({ columns, rows, affectedRows, rowCount: rows.length, durationMs: 1, truncated: false, isQuery: columns.length > 0, lastInsertId: '' })

test('104 command receipts retain all messages but create no dataset navigation', () => {
  const run = { source: '', statements: Array.from({ length: 104 }, (_, index) => ({ sql: `INSERT INTO sample VALUES (${index})`, result: result() })) }
  assert.equal(statementOutputs(run).length, 104)
  assert.equal(resultOutputs(run).length, 0)
  assert.equal(defaultOutputView(run, 103, false), 'summary')
  assert.equal(defaultOutputView(run, 103, true), 'messages')
})

test('mixed results preserve original statement indexes including empty SELECT and RETURNING', () => {
  const data = result([{ name: 'id', type: 'int' }], [['1']])
  const empty = result([{ name: 'id', type: 'int' }])
  const run = {
    source: '',
    statements: [
      { sql: 'SET NAMES utf8mb4', result: result() },
      { sql: 'SELECT 1', result: data },
      { sql: 'INSERT', result: result() },
      { sql: 'SELECT empty', result: empty },
      { sql: 'INSERT RETURNING', result: data }
    ]
  }
  assert.deepEqual(
    resultOutputs(run).map(({ index }) => index),
    [1, 3, 4]
  )
  assert.equal(defaultOutputView(run, 3, false), '3')
  assert.equal(defaultOutputView(run, 2, false), 'summary')
  assert.equal(resultOutputs(run)[0].item.result, data)
})

test('failures default to full messages without dropping completed data or error detail', () => {
  const error = 'duplicate key\n后续 1 条语句未执行。'
  const run = {
    source: '',
    error,
    statements: [
      { sql: 'SELECT 1', result: result([{ name: 'id' }], [['1']]) },
      { sql: 'INSERT duplicate', error }
    ]
  }
  assert.equal(defaultOutputView(run, 1, false), 'messages')
  assert.equal(statementOutputs(run)[1].error, error)
  assert.deepEqual(
    resultOutputs(run).map(({ index }) => index),
    [0]
  )
  assert.equal(defaultOutputView({ ...run, error: undefined }, 0, false), '0')
})

test('legacy snapshots and object datasets keep their single result; no output stays in messages', () => {
  const data = result([{ name: 'DDL' }], [['CREATE TABLE sample(id int)']])
  assert.equal(resultOutputs({ source: '', result: data })[0].index, 0)
  assert.equal(defaultOutputView({ source: '', result: data }, 0, false), '0')
  assert.equal(defaultOutputView({ source: '', result: result() }, 0, false), 'summary')
  assert.equal(defaultOutputView({ source: '' }, 0, false), 'messages')
})
