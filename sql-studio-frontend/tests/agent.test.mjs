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
