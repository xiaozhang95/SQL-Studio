import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { view } from '../src/agent/services/chat/index.ts'
import { saveRecoveryFile } from '../src/utils/recoveryFile/index.ts'

test('query sessions keep request and result ownership across switches and stale completion', () => {
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useQuerySession/index.ts', import.meta.url), 'utf8')
  const code = stripTypeScriptTypes(source.slice(source.indexOf('export function')).replace('export function', 'function'))
  const slots = [],
    cleanups = []
  let cursor = 0
  const deps = {
    useState: (initial) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [
        slots[index],
        (value) => {
          slots[index] = typeof value === 'function' ? value(slots[index]) : value
        }
      ]
    },
    useRef: (initial) => (slots[cursor++] ??= { current: initial }),
    useLayoutEffect: (effect) => effect(),
    useEffect: (effect) => {
      const index = cursor++
      if (!(index in slots)) {
        slots[index] = true
        cleanups.push(effect())
      }
    }
  }
  const hook = new Function(...Object.keys(deps), code + ';return useQuerySession')(...Object.values(deps))
  const render = () => {
    cursor = 0
    return hook()
  }
  let session = render()
  const first = session.startRun('first', { source: 'first', kind: 'query' })
  session.cancelQuery()
  assert.equal(first.signal.aborted, true)
  const second = render().startRun('second', { source: 'second', kind: 'data' })
  session.finishRun(first)
  assert.equal(render().runningTabId, 'second')
  session.closedPages.current.add('first')
  session.publishResult('first', { source: 'late result' })
  const result = { columns: [], rows: [], isQuery: true }
  session.replaceTableResult('second', result)
  session = render()
  assert.equal(session.runs.first.source, 'first')
  assert.equal(session.runs.second.result, result)
  session.finishRun(second)
  assert.equal(render().runningTabId, '')
  assert.equal(session.request.current, null)
  cleanups.forEach((cleanup) => cleanup?.())
})

test('SQL shortcut only runs inside the visible editor and never through a dialog', () => {
  const source = readFileSync(new URL('../src/pages/workspace/hooks/useQueryShortcut/index.ts', import.meta.url), 'utf8')
  const implementation = stripTypeScriptTypes(source.slice(source.indexOf('export function')).replace('export function', 'function'))
  class Node {}
  const inside = new Node(),
    outside = new Node()
  let handler,
    ref,
    visibleDialog = false,
    runs = 0,
    prevented = 0
  const deps = {
    Node,
    window: {
      addEventListener: (_name, callback, capture) => {
        assert.equal(capture, true)
        handler = callback
      },
      removeEventListener() {}
    },
    document: { querySelectorAll: () => (visibleDialog ? [{ getClientRects: () => [1] }] : []) },
    useRef: (value) => (ref ??= { current: value }),
    useLayoutEffect: (effect) => effect(),
    useEffect: (effect) => effect()
  }
  const hook = new Function(...Object.keys(deps), implementation + ';return useQueryShortcut')(...Object.values(deps))
  const editor = { current: { dom: { contains: (node) => node === inside } } }
  const run = () => runs++
  const press = (patch = {}) => handler({ key: 'Enter', ctrlKey: true, target: inside, preventDefault: () => prevented++, stopPropagation() {}, ...patch })
  hook({ enabled: true, editor, run })
  press()
  press({ ctrlKey: false, metaKey: true })
  assert.equal(runs, 2)
  press({ target: outside })
  press({ isComposing: true })
  press({ shiftKey: true })
  press({ altKey: true })
  visibleDialog = true
  press()
  visibleDialog = false
  hook({ enabled: false, editor, run })
  press()
  assert.equal(runs, 2)
  assert.equal(prevented, 2, 'unrelated keyboard input must retain its own behavior')
})

test('history restoration follows bounded pages without mixing revisions', async () => {
  const original = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return new Response(
      JSON.stringify(
        calls.length === 1 ? { busy: false, revision: 8, events: [{ type: 'user', text: '问题' }], nextOffset: 1 } : { busy: false, revision: 8, events: [{ type: 'answer', text: '回答' }] }
      )
    )
  }
  try {
    const output = await view('example', new AbortController().signal)
    assert.deepEqual(
      output.events.map((e) => e.text),
      ['问题', '回答']
    )
    assert.equal(calls[1], '/api/agent/sessions/example?offset=1&revision=8')
    calls.length = 0
    globalThis.fetch = async () => new Response(JSON.stringify({ busy: false, revision: 8, events: [], nextOffset: 0 }))
    await assert.rejects(view('example', new AbortController().signal), /分页响应无效/)
  } finally {
    globalThis.fetch = original
  }
})

test('recovery export never reloads, and failed writes abort without claiming success', async () => {
  const original = globalThis.window
  const writes = []
  let aborted = 0,
    reloads = 0
  globalThis.window = {
    location: { reload: () => reloads++ },
    showSaveFilePicker: async () => ({ createWritable: async () => ({ write: async (blob) => writes.push(JSON.parse(await blob.text())), close: async () => {}, abort: async () => aborted++ }) })
  }
  try {
    assert.match(await saveRecoveryFile({ sql: 'SELECT 1', histories: [] }), /已保存/)
    assert.equal(writes[0].sql, 'SELECT 1')
    window.showSaveFilePicker = async () => {
      throw new DOMException('已取消', 'AbortError')
    }
    await assert.rejects(saveRecoveryFile({}), { name: 'AbortError' })
    window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => {
          throw new Error('disk full')
        },
        close: async () => assert.fail('must not close'),
        abort: async () => aborted++
      })
    })
    await assert.rejects(saveRecoveryFile({}), /disk full/)
    assert.equal(aborted, 1)
    assert.equal(reloads, 0)
  } finally {
    globalThis.window = original
  }
})
