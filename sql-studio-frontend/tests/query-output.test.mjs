import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { batchRequestError, defaultOutputView, executionCancelled, resultOutputs, statementOutputs } from '../src/pages/workspace/utils/queryOutput/index.ts'

const result = (columns = [], rows = [], affectedRows = 1) => ({ columns, rows, affectedRows, rowCount: rows.length, durationMs: 1, truncated: false, isQuery: columns.length > 0, lastInsertId: '' })

test('104 command receipts retain all messages but create no dataset navigation', () => {
  const run = { source: '', statements: Array.from({ length: 104 }, (_, index) => ({ sql: `INSERT INTO sample VALUES (${index})`, result: result() })) }
  assert.equal(statementOutputs(run).length, 104)
  assert.equal(resultOutputs(run).length, 0)
  assert.equal(defaultOutputView(run, 103, false), 'summary')
  assert.equal(defaultOutputView(run, 103, true), 'messages')
})

test('batch-final errors remain separate from successful receipts and statement failures', () => {
  const error = 'SQL 批次未结束 PostgreSQL 事务，未提交的更改已回滚'
  const statements = [{ sql: 'BEGIN' }, { sql: 'SELECT 1' }]
  assert.equal(batchRequestError({ statements, error }), error)
  assert.equal(batchRequestError({ statements: [...statements, { sql: 'SELECT 2', error }], error }), undefined)
  assert.equal(batchRequestError({ statements, error, cancelled: true }), undefined)
  assert.equal(batchRequestError({ error }), undefined)
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

test('cancellation preserves completed dataset navigation and recognizes older records', () => {
  const kept = result([{ name: 'id' }], [['1']])
  const run = {
    source: '',
    cancelled: true,
    statements: [
      { sql: 'SELECT 1', result: kept },
      { sql: 'SELECT SLEEP(3)', cancelled: true }
    ]
  }
  assert.equal(defaultOutputView(run, 1, false), 'messages')
  assert.equal(defaultOutputView(run, 0, false), '0')
  assert.equal(resultOutputs(run)[0].item.result, kept)
  assert.equal(executionCancelled({ error: '请求已取消。\n后续 1 条语句未执行。' }), true)
  assert.equal(executionCancelled({ error: 'canceling statement due to statement timeout' }), false)
})

function messageScrollHarness(overrides = {}) {
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useQueryMessageScroll/index.ts', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '')
    .replace('export function', 'function')
  const slots = [],
    effects = [],
    observers = new Set()
  let cursor = 0
  const viewport = {
    clientHeight: 200,
    scrollHeight: 600,
    top: 0,
    listeners: new Map(),
    get scrollTop() {
      return this.top
    },
    set scrollTop(value) {
      this.top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight))
    },
    scrollTo({ top }) {
      this.scrollTop = top
    },
    addEventListener(type, callback) {
      this.listeners.set(type, callback)
    },
    removeEventListener(type) {
      this.listeners.delete(type)
    },
    dispatch(type, fields = {}) {
      this.listeners.get(type)?.(fields)
    }
  }
  const content = { parentElement: viewport }
  const ref = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  }
  const effect = (callback, deps) => {
    const index = cursor++
    const prior = slots[index]
    if (!prior || !deps || deps.some((value, i) => value !== prior.deps?.[i]))
      effects.push(() => {
        prior?.cleanup?.()
        slots[index] = { deps, cleanup: callback() }
      })
  }
  class Observer {
    constructor(callback) {
      this.callback = callback
    }
    observe() {
      observers.add(this.callback)
    }
    disconnect() {
      observers.delete(this.callback)
    }
  }
  const hook = new Function('useRef', 'useLayoutEffect', 'useCallback', 'ResizeObserver', stripTypeScriptTypes(source) + '; return useQueryMessageScroll')(
    ref,
    effect,
    (callback) => callback,
    Observer
  )
  let options = { progress: 3, running: true, ...overrides }
  return {
    viewport,
    observers,
    render(patch = {}) {
      options = { ...options, ...patch }
      cursor = 0
      hook(options).current = content
      effects.splice(0).forEach((callback) => callback())
    },
    resize: () => [...observers].forEach((callback) => callback()),
    unmount: () => slots.forEach((slot) => slot?.cleanup?.())
  }
}

test('running messages follow appended receipts and measured height; manual reading pauses until returning to bottom', () => {
  const h = messageScrollHarness()
  h.render()
  assert.equal(h.viewport.scrollTop, 400)
  h.viewport.scrollHeight = 800
  h.render({ progress: 4 })
  assert.equal(h.viewport.scrollTop, 600)
  h.viewport.dispatch('wheel', { deltaY: -120 })
  h.viewport.scrollTop = 350
  h.viewport.dispatch('scroll')
  h.viewport.scrollHeight = 1000
  h.render({ progress: 5 })
  h.resize()
  assert.equal(h.viewport.scrollTop, 350)
  h.viewport.scrollTop = h.viewport.scrollHeight
  h.viewport.dispatch('scroll')
  h.viewport.scrollHeight = 1200
  h.resize()
  assert.equal(h.viewport.scrollTop, 1000)
  h.render({ running: false })
  h.viewport.scrollHeight = 1300
  h.resize()
  assert.equal(h.viewport.scrollTop, 1100)
  h.unmount()
  assert.equal(h.viewport.listeners.size, 0)
  assert.equal(h.observers.size, 0)
})

test('scrollbar and keyboard reading pause; mounting a new batch starts at the appropriate end', () => {
  const h = messageScrollHarness()
  h.render()
  h.viewport.scrollTop = 100
  h.viewport.dispatch('scroll')
  h.viewport.scrollHeight = 800
  h.render({ progress: 4 })
  assert.equal(h.viewport.scrollTop, 100)
  h.viewport.scrollTop = 800
  h.viewport.dispatch('scroll')
  h.viewport.dispatch('keydown', { key: 'PageUp' })
  h.viewport.scrollTop = 250
  h.viewport.scrollHeight = 1000
  h.render({ progress: 99 })
  h.resize()
  assert.equal(h.viewport.scrollTop, 250)
  h.unmount()

  const next = messageScrollHarness({ progress: 120 })
  next.render()
  assert.equal(next.viewport.scrollTop, 400)
  next.unmount()

  const saved = messageScrollHarness({ progress: 120, running: false })
  saved.render()
  saved.resize()
  assert.equal(saved.viewport.scrollTop, 0)
  saved.unmount()
})

test('crossing the former 50-message boundary follows the same continuous viewport', () => {
  const h = messageScrollHarness({ progress: 50 })
  h.render()
  h.viewport.scrollHeight = 650
  h.render({ progress: 51 })
  assert.equal(h.viewport.scrollTop, 450)
  h.viewport.scrollTop = 120
  h.viewport.dispatch('scroll')
  h.viewport.scrollHeight = 1400
  h.render({ progress: 104 })
  h.resize()
  assert.equal(h.viewport.scrollTop, 120)
  h.unmount()
})
