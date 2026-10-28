import assert from 'node:assert/strict'
import test from 'node:test'

import { deleteRowSQL as mysqlDelete } from '../src/databases/mysql/dataEditing/index.ts'
import { prepareDump } from '../src/databases/postgresql/dataDump/index.ts'
import { deleteRowSQL as pgDelete } from '../src/databases/postgresql/dataEditing/index.ts'
import { streamTableData } from '../src/services/dataExport/index.ts'
import { createExportWriter } from '../src/utils/exportWriter/index.ts'

const result = {
  columns: [
    { name: 'id', type: 'BIGINT' },
    { name: 'label', type: 'TEXT' }
  ],
  rows: [['9007199254740993', '中文😀']],
  rowCount: 1,
  affectedRows: 0,
  lastInsertId: '',
  durationMs: 0,
  truncated: false,
  isQuery: true
}
const frame = (event) => `data: ${JSON.stringify(event)}\n\n`
function response(text) {
  const bytes = new TextEncoder().encode(text)
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 3) controller.enqueue(bytes.slice(i, i + 3))
        controller.close()
      }
    }),
    { headers: { 'content-type': 'text/event-stream' } }
  )
}
test('SSE handles split UTF-8, heartbeat, explicit scope, ordered callbacks and requires done', async () => {
  const previous = globalThis.fetch
  try {
    const frames = ': heartbeat\n\n' + frame({ type: 'rows', result }) + frame({ type: 'rows', result }) + frame({ type: 'done' })
    let received = 0
    globalThis.fetch = async (url, options) => {
      assert.ok(url.includes('owner%2F2/export-data?database=same+db&table=table%22'))
      assert.ok(options.signal)
      return response(frames)
    }
    await streamTableData(
      'owner/2',
      'same db',
      'table"',
      async (chunk) => {
        assert.deepEqual(chunk, result)
        received++
        await Promise.resolve()
      },
      new AbortController().signal
    )
    assert.equal(received, 2)
    globalThis.fetch = async () => response(frame({ type: 'rows', result }))
    await assert.rejects(
      streamTableData('a', 'd', 't', async () => {}, new AbortController().signal),
      /提前中断/
    )
    globalThis.fetch = async () => response(frame({ type: 'error', error: 'cursor failed' }))
    await assert.rejects(
      streamTableData('a', 'd', 't', async () => {}, new AbortController().signal),
      /cursor failed/
    )
    globalThis.fetch = async () => response(frame({ type: 'rows', result: { ...result, truncated: true } }))
    await assert.rejects(
      streamTableData('a', 'd', 't', async () => {}, new AbortController().signal),
      /不完整/
    )
  } finally {
    globalThis.fetch = previous
  }
})
test('native export only commits on close and discards failed writes', async () => {
  const old = globalThis.window
  let committed = false,
    aborted = false,
    parts = []
  globalThis.window = {
    showSaveFilePicker: async (options) => {
      assert.equal(options.suggestedName, 'a_b.sql')
      return {
        createWritable: async () => ({
          write: async (part) => parts.push(await part.text()),
          close: async () => {
            committed = true
          },
          abort: async () => {
            aborted = true
          }
        })
      }
    }
  }
  try {
    const output = await createExportWriter('a/b')
    await output.write('结构\n')
    await output.write('数据\n')
    assert.equal(committed, false)
    assert.deepEqual(parts, ['结构\n', '数据\n'])
    await output.abort()
    assert.equal(aborted, true)
    assert.equal(committed, false)
    const success = await createExportWriter('a/b')
    await success.close()
    assert.equal(committed, true)
  } finally {
    globalThis.window = old
  }
})
test('deleting rows requires all compound primary keys and preserves explicit engine scope', () => {
  const columns = [
    { name: 'id', key: 'PRI', type: 'bigint' },
    { name: 'label', key: 'PRI', type: 'text' }
  ]
  for (const fn of [mysqlDelete, pgDelete]) {
    assert.throws(() => fn('db', 't', [], result, result.rows[0]), /主键/)
    assert.throws(() => fn('db', 't', [...columns, { name: 'missing', key: 'PRI', type: 'int' }], result, result.rows[0]), /主键/)
    assert.throws(() => fn('db', 't', columns, result, [null, 'x']), /主键/)
  }
  const mysql = mysqlDelete('db`', 'table`', columns, result, result.rows[0])
  assert.ok(mysql.startsWith('DELETE FROM `db```.`table``` WHERE'))
  assert.ok(mysql.endsWith(' LIMIT 1;'))
  const pg = pgDelete('db', '"odd.schema"."table"', columns, result, result.rows[0])
  assert.ok(pg.startsWith('DELETE FROM "odd.schema"."table" WHERE'))
  assert.ok(pg.includes('9007199254740993'))
})
test('PostgreSQL export defers foreign keys and keeps quoted expressions intact', () => {
  const columns = [
    { name: 'id', type: 'bigint', extra: '', default: null },
    { name: 'label', type: 'text', extra: '', default: null }
  ]
  const ddl = `CREATE TABLE "a"."t" (\n "id" bigint,\n "label" text DEFAULT E'hello,\\n  CONSTRAINT fake FOREIGN KEY (x)',\n CONSTRAINT "odd,\nname" FOREIGN KEY ("id") REFERENCES "a"."other"("id")\n);\nCREATE INDEX "i" ON "a"."t" ("id");`
  const metadata = { ...result, columns: [], rows: [], rowCount: 0 }
  const plan = prepareDump('db', '"a"."t"', ddl, columns, metadata, true)
  assert.ok(plan.before.includes("DEFAULT E'hello,\\n  CONSTRAINT fake FOREIGN KEY (x)'"))
  assert.ok(!plan.before.includes('REFERENCES'))
  assert.ok(plan.constraints.includes('ALTER TABLE "a"."t" ADD CONSTRAINT "odd,\nname"'))
  assert.ok(plan.before.includes('CREATE INDEX'))
  assert.ok(plan.data(result).includes('9007199254740993'))
  const structure = prepareDump('db', '"a"."t"', ddl, columns, metadata, false)
  assert.ok(structure.constraints.includes('REFERENCES'))
})
