import assert from 'node:assert/strict'
import test from 'node:test'

import { checkDatabaseSync, runDatabaseSync } from '../src/services/databaseSync/index.ts'

const input = { sourceConnectionId: 'source', sourceDatabase: 'alpha', targetConnectionId: 'target', targetDatabase: 'beta', structure: true, data: true, createDatabase: true }
const progress = { phase: 'table_done', table: '中文😀', created: true, completed: 1, tables: 1, skippedViews: 0, rows: 450 }
const frame = (value) => JSON.stringify(value) + '\n'

test('sync stream handles fragmented UTF-8, counts and terminal result', async (t) => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/database-sync/run')
    assert.deepEqual(JSON.parse(options.body), input)
    const bytes = new TextEncoder().encode(frame({ type: 'heartbeat' }) + frame({ type: 'progress', progress }) + frame({ type: 'done' }))
    return new Response(
      new ReadableStream({
        start(controller) {
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
          controller.close()
        }
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  }
  const seen = []
  await runDatabaseSync(input, new AbortController().signal, (p) => seen.push(p))
  assert.deepEqual(seen, [progress])
})

test('sync never reports incomplete streams as completion', async (t) => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  const reply = (text) => {
    globalThis.fetch = async () => new Response(text, { headers: { 'Content-Type': 'application/x-ndjson' } })
  }
  const run = () => runDatabaseSync(input, new AbortController().signal, () => {})
  reply(frame({ type: 'progress', progress }))
  await assert.rejects(run(), /提前中断/)
  reply(frame({ type: 'done' }))
  await assert.rejects(run(), /格式无效/)
  reply(frame({ type: 'error', error: '目标数据库已存在，同步已停止' }))
  await assert.rejects(run(), /目标数据库已存在/)
  reply(frame({ type: 'progress', progress }) + frame({ type: 'progress', progress: { ...progress, rows: progress.rows - 1 } }))
  await assert.rejects(run(), /格式无效/)
  reply('not json\n')
  await assert.rejects(run(), /格式无效/)
  reply(frame({ type: 'heartbeat', padding: 'x'.repeat(32768) }))
  await assert.rejects(run(), /格式无效/)
})

test('invalid preflight cannot enable sync and notices are propagated', async (t) => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  const check = () => checkDatabaseSync(input, new AbortController().signal)
  for (const value of [null, {}, { tables: -1, skippedViews: 0 }, { tables: 1, skippedViews: '0' }]) {
    globalThis.fetch = async () => Response.json(value)
    await assert.rejects(check(), /格式无效/)
  }
  globalThis.fetch = async () => Response.json({ tables: 2, skippedViews: 1 })
  assert.deepEqual(await check(), { tables: 2, skippedViews: 1 })
  globalThis.fetch = async () => Response.json({ error: '目标数据库已存在' }, { status: 400 })
  await assert.rejects(check(), { status: 400 })
})

test('abort during a callback prevents remaining frames and cancels the reader', async (t) => {
  const original = globalThis.fetch
  t.after(() => {
    globalThis.fetch = original
  })
  let cancelled = false
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(frame({ type: 'progress', progress }) + frame({ type: 'done' })))
        },
        cancel() {
          cancelled = true
        }
      }),
      { headers: { 'Content-Type': 'application/x-ndjson' } }
    )
  const controller = new AbortController()
  await assert.rejects(
    runDatabaseSync(input, controller.signal, () => controller.abort()),
    { name: 'AbortError' }
  )
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(cancelled, true)
})
