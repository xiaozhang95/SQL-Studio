import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
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

function messageScrollHarness(overrides = {}) {
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useQueryMessageScroll/index.ts', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '')
    .replace('export function', 'function')
  const slots = [],
    effects = [],
    observers = new Set(),
    follows = []
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
  let options = { identity: 'run-1', progress: 3, page: 1, latest: true, running: true, onFollowChange: (value) => follows.push(value), ...overrides }
  return {
    viewport,
    follows,
    observers,
    render(patch = {}) {
      options = { ...options, ...patch }
      cursor = 0
      const result = hook(options)
      result.content.current = content
      effects.splice(0).forEach((callback) => callback())
      return result
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
  assert.deepEqual(h.follows, [false])
  h.viewport.scrollTop = h.viewport.scrollHeight
  h.viewport.dispatch('scroll')
  assert.deepEqual(h.follows, [false, true])
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

test('scrollbar and keyboard reading pause; old pagination and historical batches do not follow; new runs reset', () => {
  const h = messageScrollHarness()
  h.render()
  h.viewport.scrollTop = 100
  h.viewport.dispatch('scroll')
  assert.deepEqual(h.follows, [false])
  h.viewport.scrollHeight = 800
  h.render({ progress: 4 })
  assert.equal(h.viewport.scrollTop, 100)
  h.viewport.scrollTop = 800
  h.viewport.dispatch('scroll')
  h.viewport.dispatch('keydown', { key: 'PageUp' })
  assert.deepEqual(h.follows, [false, true, false])
  h.render({ page: 2, latest: false, progress: 99 })
  assert.equal(h.viewport.scrollTop, 0)
  h.viewport.scrollHeight = 1000
  h.resize()
  assert.equal(h.viewport.scrollTop, 0)
  h.render({ identity: 'next-run', page: 1, latest: true, progress: 1 })
  assert.equal(h.viewport.scrollTop, 800)
  h.render({ identity: 'saved-run', running: false, progress: 12 })
  assert.equal(h.viewport.scrollTop, 0)
  h.resize()
  assert.equal(h.viewport.scrollTop, 0)
  h.unmount()
})

test('automatic latest page follows its content while manual pagination starts at the top', () => {
  const h = messageScrollHarness({ progress: 50 })
  h.render()
  h.viewport.scrollHeight = 100
  h.render({ progress: 51, page: 2 })
  assert.equal(h.viewport.scrollTop, 0)
  h.viewport.scrollHeight = 600
  h.render({ progress: 60 })
  assert.equal(h.viewport.scrollTop, 400)
  h.render().pause()
  h.render({ page: 1, latest: false })
  assert.equal(h.viewport.scrollTop, 0)
  h.viewport.scrollTop = 120
  h.resize()
  assert.equal(h.viewport.scrollTop, 120)
  h.unmount()
})
