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
  const source = (await fs.readFile(new URL('../src/agent/pages/chat/hooks/writeConfirmation/index.ts', import.meta.url), 'utf8')).replace(/^import .* from '[^']+'\n/gm, '')
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
