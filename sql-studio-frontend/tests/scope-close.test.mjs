import assert from 'node:assert/strict'
import test from 'node:test'

import { DatabaseLifecycle } from '../src/pages/workspace/utils/databaseLifecycle/index.ts'
import { pagesForScope, sqlForPages } from '../src/pages/workspace/utils/scopeClose/index.ts'
import { saveSQL } from '../src/utils/sqlSave/index.ts'

test('closing a database selects every associated query and page without crossing connection or database', () => {
  const pages = [
    { id: '1', connectionId: 'a', database: 'same', kind: 'query', title: '查询1', sql: 'SELECT 1;' },
    { id: '2', connectionId: 'a', database: 'same', kind: 'query', title: '查询2', sql: 'SELECT 2;' },
    { id: '3', connectionId: 'a', database: 'same', kind: 'data', title: '数据', sql: '' },
    { id: '4', connectionId: 'a', database: 'other', kind: 'query', title: '查询3', sql: 'SELECT 3;' },
    { id: '5', connectionId: 'b', database: 'same', kind: 'query', title: '查询4', sql: 'SELECT 4;' }
  ]
  const affected = pagesForScope(pages, 'a', 'same')
  assert.deepEqual(
    affected.map((page) => page.id),
    ['1', '2', '3']
  )
  assert.equal(pagesForScope(pages, 'a').length, 4)
  assert.equal(sqlForPages(affected), '-- 查询1 / same\nSELECT 1;\n\n-- 查询2 / same\nSELECT 2;')
  assert.equal(sqlForPages([pages[0]]), 'SELECT 1;')
})

test('scope cancellation is isolated and old generations remain invalid after reopen', () => {
  const connection = new AbortController()
  const lifecycle = new DatabaseLifecycle(connection.signal)
  const old = lifecycle.scope('same'),
    other = lifecycle.scope('other')
  lifecycle.close('same')
  assert.equal(old.signal.aborted, true)
  assert.equal(other.valid(), true)
  const reopened = lifecycle.scope('same')
  assert.equal(old.valid(), false)
  assert.equal(reopened.valid(), true)
  connection.abort()
  assert.equal(other.signal.aborted, true)
  assert.equal(reopened.signal.aborted, true)
})

test('SQL save waits for file completion and cancellation/write failure reject', async () => {
  const original = globalThis.window
  const events = []
  globalThis.window = {
    showSaveFilePicker: async () => ({
      createWritable: async () => ({ write: async (blob) => events.push(await blob.text()), close: async () => events.push('closed'), abort: async () => events.push('aborted') })
    })
  }
  try {
    await saveSQL('SELECT 1;', 'query')
    assert.deepEqual(events, ['SELECT 1;', 'closed'])
    globalThis.window.showSaveFilePicker = async () => {
      throw new DOMException('cancel', 'AbortError')
    }
    await assert.rejects(saveSQL('SELECT 2;', 'query'), { name: 'AbortError' })
    globalThis.window.showSaveFilePicker = async () => ({
      createWritable: async () => ({
        write: async () => {
          throw Error('disk full')
        },
        close: async () => events.push('must not close'),
        abort: async () => events.push('aborted')
      })
    })
    await assert.rejects(saveSQL('SELECT 3;', 'query'), /disk full/)
    assert.equal(events.at(-1), 'aborted')
  } finally {
    globalThis.window = original
  }
})
