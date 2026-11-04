import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import ts from 'typescript'

async function moduleAt(relative) {
  let text = await fs.readFile(new URL('../src/agent/' + relative, import.meta.url), 'utf8')
  text = text.replace(
    /import\s+\{\s*isObject\s*\}\s+from\s+["'][^"']+["'];?/,
    "function isObject(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === 'object' && !Array.isArray(v); }"
  )
  const output = ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'))
}

test('Enter发送，Shift+Enter换行，IME确认候选不提交', async () => {
  const { shouldSendOnEnter } = await moduleAt('utils/inputSubmission/index.ts')
  const enter = {
    key: 'Enter',
    shiftKey: false,
    isComposing: false,
    keyCode: 13
  }
  assert.equal(shouldSendOnEnter(enter), true)
  assert.equal(shouldSendOnEnter({ ...enter, shiftKey: true }), false)
  assert.equal(shouldSendOnEnter({ ...enter, isComposing: true }), false)
  assert.equal(shouldSendOnEnter({ ...enter, keyCode: 229 }), false)
  assert.equal(shouldSendOnEnter({ ...enter, key: 'a' }), false)
})

test('虚拟对话按提问划分，保留错误归属；导航摘要排除思考且刻度有界', async () => {
  const { conversationRounds, roundMarkers } = await moduleAt('utils/conversationRounds/index.ts')
  const entries = [
    { id: 1, role: 'user', text: '第一个问题' },
    { id: 2, role: 'thinking', text: '不能作为摘要的思考' },
    { id: 3, role: 'assistant', text: '第一轮回答' },
    { id: 4, role: 'error', text: '第一轮错误' },
    { id: 5, role: 'user', text: '第二个问题' },
    { id: 6, role: 'assistant', text: '第二轮回答' }
  ]
  const rounds = conversationRounds(entries)
  assert.deepEqual(
    rounds.map((round) => [round.id, round.summary, round.entries.map((entry) => entry.id)]),
    [
      [1, '第一轮回答', [1, 2, 3, 4]],
      [5, '第二轮回答', [5, 6]]
    ]
  )
  const markers = roundMarkers(10000, 5234)
  assert.ok(markers.length <= 24)
  assert.ok(markers.includes(5234) && markers.includes(0) && markers.includes(9999))
  assert.deepEqual(roundMarkers(0, 0), [])
  assert.deepEqual(conversationRounds([]), [])
})

test('旧后端拒绝ensure时提示重启，不自动重复创建', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => {
    calls++
    return new Response(JSON.stringify({ error: 'json: unknown field "ensure"' }), { status: 400 })
  }
  try {
    const api = await moduleAt('services/chat/index.ts')
    await assert.rejects(api.create(undefined, true), /go run main.go/)
    assert.equal(calls, 1)
  } finally {
    globalThis.fetch = original
  }
})

test('空会话列表先ensure创建，有历史时不重复创建；重命名正确传递中文与目标ID', async () => {
  const original = globalThis.fetch
  const item = { id: 'a'.repeat(48), title: '新建会话', revision: 1, status: 'idle', updatedAt: '2026-11-03T00:00:00Z' }
  let existing = []
  const calls = []
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body })
    if (init.method === 'POST') {
      assert.deepEqual(JSON.parse(init.body), { ensure: true })
      existing = [item]
      return Response.json({ id: item.id })
    }
    if (init.method === 'PATCH') {
      assert.equal(url, '/api/agent/sessions/' + item.id)
      const { title } = JSON.parse(init.body)
      return Response.json({ ...item, title, revision: 2 })
    }
    return Response.json(existing)
  }
  try {
    const api = await moduleAt('services/chat/index.ts')
    assert.deepEqual(await api.ensureHistory(), [item])
    assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
    await api.ensureHistory()
    assert.equal(calls.filter((c) => c.method === 'POST').length, 1)
    const renamed = await api.rename(item.id, '订单统计')
    assert.equal(renamed.title, '订单统计')
    assert.equal(renamed.revision, 2)
  } finally {
    globalThis.fetch = original
  }
})

test('共享Key保存、窗口回焦与移除会刷新Agent状态，迟到响应不覆盖新状态', async () => {
  const original = { fetch: globalThis.fetch, window: globalThis.window, document: globalThis.document }
  const browser = new EventTarget()
  const doc = new EventTarget()
  doc.visibilityState = 'visible'
  globalThis.window = browser
  globalThis.document = doc
  const requests = []
  globalThis.fetch = (url, options) => {
    assert.equal(url, '/api/agent/settings')
    assert.equal(options.method, 'GET')
    return new Promise((resolve) => requests.push({ resolve, signal: options.signal }))
  }
  const flush = () => new Promise((resolve) => setImmediate(resolve))
  const response = (configured) =>
    new Response(JSON.stringify({ configured, model: 'deepseek-flash', source: configured ? 'saved' : 'none', models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] }))
  let dispose
  try {
    const { observeSettings } = await moduleAt('services/settings/index.ts')
    const states = [],
      errors = []
    dispose = observeSettings(
      (value) => states.push(value.configured),
      (error) => errors.push(error)
    )
    requests[0].resolve(response(false))
    await flush()
    browser.dispatchEvent(new Event('ai-settings-saved'))
    browser.dispatchEvent(new Event('focus'))
    assert.equal(requests[1].signal.aborted, true)
    requests[2].resolve(response(true))
    await flush()
    requests[1].resolve(response(false))
    await flush()
    assert.deepEqual(states, [false, true])
    doc.dispatchEvent(new Event('visibilitychange'))
    requests[3].resolve(response(false))
    await flush()
    assert.deepEqual(states, [false, true, false])
    assert.deepEqual(errors, [])
    browser.dispatchEvent(new Event('focus'))
    dispose()
    dispose = undefined
    assert.equal(requests[4].signal.aborted, true)
    browser.dispatchEvent(new Event('ai-settings-saved'))
    assert.equal(requests.length, 5)
  } finally {
    dispose?.()
    globalThis.fetch = original.fetch
    if (original.window === undefined) delete globalThis.window
    else globalThis.window = original.window
    if (original.document === undefined) delete globalThis.document
    else globalThis.document = original.document
  }
})

test('查询表格保留重复列、NULL、空字符串和精确数值，拒绝损坏二维结果', async () => {
  const { readResult, cellText, readSQL } = await moduleAt('utils/queryResult/index.ts')
  const raw = {
    columns: [
      { name: '值', type: 'DECIMAL' },
      { name: '值', type: 'TEXT' },
      { name: '空值', type: 'TEXT' }
    ],
    rows: [['9007199254740993', '', null]],
    durationMs: 3,
    truncated: true
  }
  const result = readResult(raw)
  assert.deepEqual(
    result.columns.map((c) => c.name),
    ['值', '值', '空值']
  )
  assert.equal(result.rows[0][0], '9007199254740993')
  assert.equal(result.truncated, true)
  assert.equal(cellText(null), 'NULL')
  assert.equal(cellText(''), '空字符串')
  assert.equal(readSQL('{"sql":"SELECT 1"}'), 'SELECT 1')
  assert.equal(readSQL('invalid'), '')
  assert.equal(readResult({ ...raw, rows: [['missing columns']] }), null)
  assert.equal(readResult({ ...raw, columns: [{ name: 1 }] }), null)
})
test('思考与回答分开增量、最终回答不重复、失败保留片段', async () => {
  const { applyEvent } = await moduleAt('utils/chatEvents/index.ts')
  let entries = []
  const events = [
    { type: 'user', text: '问题' },
    { type: 'model_start' },
    { type: 'reasoning_delta', text: '先确认' },
    { type: 'reasoning_delta', text: '口径' },
    { type: 'answer_delta', text: '答' },
    { type: 'answer_delta', text: '案' },
    { type: 'answer', text: '答案' },
    { type: 'turn_end' }
  ]
  for (const e of events) entries = applyEvent(entries, e)
  assert.deepEqual(
    entries.map((e) => [e.role, e.text]),
    [
      ['user', '问题'],
      ['thinking', '先确认口径'],
      ['assistant', '答案']
    ]
  )
  assert.equal(
    entries.every((e) => !e.streaming),
    true
  )
  const previous = JSON.stringify(entries)
  let partial = applyEvent(entries, { type: 'model_start' })
  partial = applyEvent(partial, { type: 'answer_delta', text: '未完成' })
  partial = applyEvent(partial, { type: 'error', text: '取消' })
  assert.equal(partial.at(-2).text, '未完成')
  assert.equal(partial.at(-2).incomplete, true)
  const { chatErrors } = await moduleAt('utils/chatEvents/index.ts')
  assert.equal(partial.at(-1).role, 'error')
  assert.deepEqual(chatErrors([...partial, { id: 99, role: 'tool', text: '', result: { error: '查询失败' } }, { id: 100, role: 'tool', text: '', result: { error: '查询失败' } }]), [
    '本轮未完成：取消',
    '查询失败'
  ])
  assert.equal(JSON.stringify(entries), previous)
})
test('POST SSE解码支持UTF8分包，并拒绝没有done的断流', async () => {
  const api = await moduleAt('services/chat/index.ts')
  const original = globalThis.fetch
  const encoder = new TextEncoder()
  let raw = ': heartbeat\n\ndata: {"type":"reasoning_delta","text":"中文思考"}\n\ndata: {"type":"answer_delta","text":"回答"}\n\ndata: {"type":"answer","text":"回答"}\n\ndata: {"type":"done"}\n\n'
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.method, 'POST')
    const bytes = encoder.encode(raw)
    let offset = 0
    return new Response(
      new ReadableStream({
        pull(controller) {
          if (offset >= bytes.length) {
            controller.close()
            return
          }
          controller.enqueue(bytes.slice(offset, offset + 3))
          offset += 3
        }
      }),
      { headers: { 'Content-Type': 'text/event-stream' } }
    )
  }
  try {
    const events = []
    await api.chat('id', '问题', new AbortController().signal, (e) => events.push(e))
    assert.deepEqual(
      events.map((e) => e.type),
      ['reasoning_delta', 'answer_delta', 'answer', 'done']
    )
    assert.equal(events[0].text, '中文思考')
    raw = 'data: {"type":"answer_delta","text":"partial"}\n\n'
    await assert.rejects(
      api.chat('id', '问题', new AbortController().signal, () => {}),
      /未完成/
    )
  } finally {
    globalThis.fetch = original
  }
})

test('Markdown回答转换为表格，精确字符串保留', async () => {
  let source = await fs.readFile(new URL('../src/agent/utils/answerTables/index.ts', import.meta.url), 'utf8')
  let result = await fs.readFile(new URL('../src/agent/utils/queryResult/index.ts', import.meta.url), 'utf8')
  result = result
    .replace(/import \{ isObject \} from ['"][^'"]+['"]/, 'function isObject(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === "object" && !Array.isArray(v); }')
    .replace(/export /g, '')
  source = source.replace(/import \{ readResult \} from ['"][^'"]+['"]/, result)
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const { answerTables } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  const parts = answerTables('数据库如下\n| 数据库 | 说明 |\n|---|---|\n| `demo` | 业务库 |\n| 9007199254740993 | NULL |\n说明')
  assert.deepEqual(parts.find((p) => p.kind === 'table').value.rows, [
    ['demo', '业务库'],
    ['9007199254740993', 'NULL']
  ])
  assert.equal(parts.at(-1).text, '说明')
  assert.deepEqual(answerTables('```sql\nSELECT 1;\n```'), [{ kind: 'code', language: 'sql', text: 'SELECT 1;' }])
  assert.deepEqual(answerTables('```sql\nSELECT 1;'), [{ kind: 'code', language: 'sql', text: 'SELECT 1;' }])
  assert.equal(
    answerTables('```sql\n|a|b|\n|---|---|\n|1|2|\n```').some((p) => p.kind === 'table'),
    false
  )
  assert.equal(
    answerTables('```json\n{bad}\n```').some((p) => p.kind === 'table'),
    false
  )
})

async function confirmationHarness(fetch) {
  const source = (await fs.readFile(new URL('../src/agent/pages/chat/hooks/writeConfirmation/index.ts', import.meta.url), 'utf8')).replace(/^import .* from '[^']+'\r?\n/gm, '')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const slots = []
  const cleanups = []
  let cursor = 0
  const hook = new Function('exports', 'useState', 'useRef', 'useEffect', 'isObject', 'fetch', code + '; return exports.useWriteConfirmation')(
    {},
    (initial) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = initial
      return [
        slots[index],
        (value) => {
          slots[index] = value
        }
      ]
    },
    (initial) => {
      const index = cursor++
      if (!(index in slots)) slots[index] = { current: initial }
      return slots[index]
    },
    (effect) => {
      const index = cursor++
      if (!(index in slots)) {
        slots[index] = true
        cleanups.push(effect())
      }
    },
    (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
    fetch
  )
  return {
    render: () => {
      cursor = 0
      return hook()
    },
    unmount: () => cleanups.forEach((cleanup) => cleanup?.())
  }
}

const confirmationRequest = {
  approvalId: 'test-approval',
  connection: '隔离测试连接',
  database: 'fixture',
  objects: ['items'],
  sql: "UPDATE items SET name = 'sample' WHERE id = 1"
}

test('内联写入确认等待用户决定，拦截重复提交且仅发送一次性ID与决定', async () => {
  const calls = []
  let resolve
  const harness = await confirmationHarness((url, init) => {
    calls.push({ url, ...init })
    return new Promise((done) => {
      resolve = done
    })
  })
  const signal = new AbortController().signal
  harness.render().show(confirmationRequest, signal)
  assert.deepEqual(harness.render().pending, confirmationRequest)
  assert.equal(calls.length, 0)
  const submission = harness.render().decide(true)
  await harness.render().decide(false)
  assert.equal(harness.render().submitting, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/agent/write-confirmation')
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].body), { approvalId: confirmationRequest.approvalId, allow: true })
  resolve(Response.json({ ok: true }))
  await submission
  assert.equal(harness.render().pending, null)
  await harness.render().decide(true)
  assert.equal(calls.length, 1)
  harness.unmount()
})

test('内联确认失败留在卡片，用户可取消；中止、过期流和卸载不能再次提交', async () => {
  const calls = []
  const harness = await confirmationHarness(async (_url, init) => {
    calls.push(JSON.parse(init.body))
    return calls.length === 1 ? Response.json({ error: '确认失败，请重试' }, { status: 503 }) : Response.json({ ok: true })
  })
  const controller = new AbortController()
  harness.render().show(confirmationRequest, controller.signal)
  await harness.render().decide(true)
  assert.equal(harness.render().error, '确认失败，请重试')
  assert.equal(harness.render().submitting, false)
  assert.deepEqual(harness.render().pending, confirmationRequest)
  await harness.render().decide(false)
  assert.deepEqual(calls[1], { approvalId: confirmationRequest.approvalId, allow: false })
  assert.equal(harness.render().pending, null)
  harness.render().show(confirmationRequest, controller.signal)
  controller.abort()
  assert.equal(harness.render().pending, null)
  harness.render().show(confirmationRequest, controller.signal)
  assert.equal(harness.render().pending, null)
  await harness.render().decide(true)
  assert.equal(calls.length, 2)
  harness.render().show(confirmationRequest, new AbortController().signal)
  harness.render().close()
  await harness.render().decide(true)
  harness.render().show(confirmationRequest, new AbortController().signal)
  harness.unmount()
  await harness.render().decide(true)
  assert.equal(calls.length, 2)
})

test('旧确认的迟到响应不清除新卡片，损坏明细不显示或提交', async () => {
  let resolve
  const harness = await confirmationHarness(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const previous = new AbortController()
  const current = new AbortController()
  harness.render().show(confirmationRequest, previous.signal)
  const submission = harness.render().decide(true)
  const next = { ...confirmationRequest, approvalId: 'next-approval' }
  harness.render().show(next, current.signal)
  previous.abort()
  resolve(Response.json({ ok: true }))
  await submission
  assert.deepEqual(harness.render().pending, next)
  assert.equal(harness.render().submitting, false)
  assert.throws(() => harness.render().show({ ...next, objects: [42] }, current.signal), /无效/)
  harness.unmount()
})

test('历史批量还原保持增量、工具配对、最终回答及错误语义，且不修改事件', async () => {
  const { restoreEvents, applyEvent } = await moduleAt('utils/chatEvents/index.ts')
  const events = [
    { type: 'user', text: '问题', createdAt: '2026-11-04T00:00:00Z' },
    { type: 'reasoning_delta', text: '思考' },
    { type: 'tool_start', tool: 'query', arguments: 'A' },
    { type: 'tool_start', tool: 'query', arguments: 'B' },
    { type: 'tool_result', tool: 'query', result: { rows: [2] } },
    { type: 'tool_result', tool: 'query', result: { rows: [1] } },
    { type: 'answer_delta', text: '临时回答' },
    { type: 'answer', text: '完整回答' },
    { type: 'answer_delta', text: '未完成片段' },
    { type: 'error', text: '中断' },
    { type: 'done' }
  ]
  const before = structuredClone(events)
  const restored = await restoreEvents(events, new AbortController().signal)
  assert.deepEqual(restored, events.reduce(applyEvent, []))
  assert.deepEqual(
    restored.filter((entry) => entry.role === 'tool').map((entry) => entry.result.rows),
    [[1], [2]]
  )
  assert.equal(restored.at(-2).incomplete, true)
  assert.deepEqual(events, before)
})

test('长历史还原让出事件循环，可在批次之间取消，不返回部分记录', async () => {
  const { restoreEvents } = await moduleAt('utils/chatEvents/index.ts')
  const events = Array.from({ length: 12000 }, (_, i) => ({ type: 'user', text: String(i) }))
  const controller = new AbortController()
  const pending = restoreEvents(events, controller.signal)
  setTimeout(() => controller.abort(), 0)
  await assert.rejects(pending, { name: 'AbortError' })
  const restored = await restoreEvents(events, new AbortController().signal)
  assert.equal(restored.length, events.length)
  assert.equal(restored.at(-1).id, 12000)
  assert.equal(restored.at(-1).text, '11999')
})

async function chatHarness(view, initialView) {
  const events = await moduleAt('utils/chatEvents/index.ts')
  const source = (await fs.readFile(new URL('../src/agent/pages/chat/hooks/chat/index.ts', import.meta.url), 'utf8')).replace(/^import .* from '[^']+'\r?\n/gm, '')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const slots = [],
    cleanups = []
  let cursor = 0
  const state = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [
      slots[index],
      (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value
      }
    ]
  }
  const ref = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  }
  const effect = (callback) => {
    const index = cursor++
    if (!(index in slots)) {
      slots[index] = true
      cleanups.push(callback())
    }
  }
  const workspace = {
    ready: true,
    state: { activeId: '', draft: '', expanded: [] },
    update(patch) {
      this.state = { ...this.state, ...patch }
    }
  }
  const form = { resetFields() {}, setFieldsValue() {} }
  const hook = new Function(
    'exports',
    'Form',
    'useEffect',
    'useLayoutEffect',
    'useRef',
    'useState',
    'api',
    'applyEvent',
    'restoreEvents',
    'CHAT',
    'useWriteConfirmation',
    code + '; return exports.useChat'
  )(
    {},
    { useForm: () => [form] },
    effect,
    effect,
    ref,
    state,
    {
      ensureHistory: async () => [{ id: 'initial' }],
      view: (id, signal) => (id === 'initial' ? (initialView ? initialView(signal) : Promise.resolve({ busy: false, events: [] })) : view(id, signal))
    },
    events.applyEvent,
    events.restoreEvents,
    { tools: {} },
    () => ({ pending: null })
  )
  const render = () => {
    cursor = 0
    return hook(workspace)
  }
  render()
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { render, workspace, unmount: () => cleanups.forEach((cleanup) => cleanup?.()) }
}

test('连续选择取消旧请求，迟到历史不能覆盖目标会话，卸载取消读取', async () => {
  const requests = []
  const harness = await chatHarness((id, signal) => new Promise((resolve) => requests.push({ id, signal, resolve })))
  const first = harness.render().selectHistory('A')
  await new Promise((resolve) => setTimeout(resolve, 5))
  const second = harness.render().selectHistory('B')
  assert.equal(requests[0].signal.aborted, true)
  assert.equal(harness.workspace.state.activeId, 'B')
  assert.deepEqual(harness.render().entries, [])
  await new Promise((resolve) => setTimeout(resolve, 5))
  requests[1].resolve({ busy: false, events: [{ type: 'user', text: 'B消息' }] })
  await second
  requests[0].resolve({ busy: false, events: [{ type: 'user', text: 'A消息' }] })
  await first
  assert.equal(harness.render().entries[0].text, 'B消息')
  assert.equal(harness.render().loading, false)
  const third = harness.render().selectHistory('C')
  await new Promise((resolve) => setTimeout(resolve, 5))
  harness.unmount()
  assert.equal(requests[2].signal.aborted, true)
  requests[2].resolve({ busy: false, events: [{ type: 'user', text: 'C消息' }] })
  await third
  assert.deepEqual(harness.render().entries, [])
})

test('加载失败保留选中项，可重试并切换其他会话；重复选择不读取', async () => {
  let calls = 0
  const harness = await chatHarness(async () => {
    if (++calls === 1) throw new Error('读取失败')
    return { busy: false, events: [{ type: 'user', text: '恢复成功' }] }
  })
  await harness.render().selectHistory('A')
  assert.equal(harness.workspace.state.activeId, 'A')
  assert.equal(harness.render().loadError, '读取失败')
  assert.equal(harness.render().historyBusy, false)
  await harness.render().retryHistory()
  assert.equal(harness.render().loadError, '')
  assert.equal(harness.render().entries[0].text, '恢复成功')
  await harness.render().selectHistory('A')
  assert.equal(calls, 2)
  await harness.render().selectHistory('B')
  assert.equal(calls, 3)
  assert.equal(harness.workspace.state.activeId, 'B')
  harness.unmount()
})

test('首次恢复先显示索引，内容未完成时可以改选并取消初始读取', async () => {
  let complete, initialSignal
  const harness = await chatHarness(
    async () => ({ busy: false, events: [{ type: 'user', text: '新目标' }] }),
    (signal) => {
      initialSignal = signal
      return new Promise((resolve) => {
        complete = resolve
      })
    }
  )
  assert.equal(harness.render().loading, true)
  assert.equal(harness.render().historyLoading, false)
  assert.equal(harness.render().historyBusy, false)
  await harness.render().selectHistory('B')
  assert.equal(initialSignal.aborted, true)
  complete({ busy: false, events: [{ type: 'user', text: '旧初始内容' }] })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(harness.render().entries[0].text, '新目标')
  assert.equal(harness.render().loading, false)
  harness.unmount()
})

async function transcriptHarness(count = 25) {
  const source = (await fs.readFile(new URL('../src/agent/pages/chat/hooks/virtualTranscript/index.ts', import.meta.url), 'utf8')).replace(/^import .* from '[^']+'\r?\n/gm, '')
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const slots = [],
    effects = [],
    timers = new Map(),
    frames = new Map(),
    calls = []
  let cursor = 0,
    next = 0,
    rounds = Array.from({ length: count }, (_, id) => ({ id, entries: [], question: String(id), summary: '' }))
  const state = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [
      slots[index],
      (value) => {
        slots[index] = typeof value === 'function' ? value(slots[index]) : value
      }
    ]
  }
  const ref = (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  }
  const memo = (factory) => {
    cursor++
    return factory()
  }
  const effect = (callback, deps) => {
    const index = cursor++
    const prior = slots[index]
    if (!prior || deps.some((value, i) => value !== prior.deps[i])) {
      effects.push(() => {
        prior?.cleanup?.()
        slots[index] = { deps, cleanup: callback() }
      })
    }
  }
  const schedule = (map, callback) => {
    const id = ++next
    map.set(id, callback)
    return id
  }
  const hook = new Function(
    'exports',
    'useState',
    'useRef',
    'useMemo',
    'useLayoutEffect',
    'startTransition',
    'CHAT',
    'setTimeout',
    'clearTimeout',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    code + '; return exports.useVirtualTranscript'
  )(
    {},
    state,
    ref,
    memo,
    effect,
    (callback) => callback(),
    { historyBatchSize: 8, historyLoadingDelay: 80 },
    (callback) => schedule(timers, callback),
    (id) => timers.delete(id),
    (callback) => schedule(frames, callback),
    (id) => frames.delete(id)
  )
  const render = () => {
    cursor = 0
    const result = hook(rounds)
    result.list.current = { scrollToIndex: (location) => calls.push(location) }
    effects.splice(0).forEach((callback) => callback())
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback())
    return result
  }
  return {
    render,
    calls,
    timers,
    flush: () => {
      const pending = [...timers.values()]
      timers.clear()
      pending.forEach((callback) => callback())
    },
    append: () => {
      rounds = [...rounds, { id: rounds.length, entries: [], question: 'new', summary: '' }]
    },
    unmount: () => slots.forEach((slot) => slot?.cleanup?.())
  }
}

test('上滑边界先显示局部loading再分批前插，重复触发合并且不拉回末尾', async () => {
  const harness = await transcriptHarness()
  let scroll = harness.render()
  assert.equal(scroll.first, 17)
  assert.equal(scroll.visibleRounds.length, 8)
  harness.calls.length = 0
  scroll.onTop(true)
  assert.equal(harness.timers.size, 0)
  scroll.onReadHistory()
  scroll = harness.render()
  assert.equal(scroll.loadingHistory, true)
  assert.equal(scroll.first, 17)
  scroll.loadOlder()
  assert.equal(harness.timers.size, 1)
  harness.flush()
  scroll = harness.render()
  assert.equal(scroll.loadingHistory, false)
  assert.equal(scroll.first, 9)
  assert.equal(scroll.visibleRounds.length, 16)
  assert.equal(harness.calls.length, 0)
  scroll.loadOlder()
  harness.unmount()
  assert.equal(harness.timers.size, 0)
})

test('分批历史完整导航保持原始索引，回到最新与新消息跟随使用相对索引', async () => {
  const harness = await transcriptHarness()
  let scroll = harness.render()
  scroll.jump(2)
  scroll = harness.render()
  assert.equal(scroll.first, 0)
  assert.deepEqual(harness.calls.at(-1), { index: 2, align: 'start' })
  scroll.toLatest()
  assert.deepEqual(harness.calls.at(-1), { index: 24, align: 'end' })
  harness.append()
  harness.render()
  assert.deepEqual(harness.calls.at(-1), { index: 25, align: 'end' })
  harness.unmount()
  const short = await transcriptHarness(3)
  scroll = short.render()
  assert.equal(scroll.first, 0)
  scroll.loadOlder()
  assert.equal(short.timers.size, 0)
  short.unmount()
})
