import assert from 'node:assert/strict'
import test from 'node:test'

import { compareResultValues, pageResultRows, selectedResultRows, sortResultRows } from '../src/pages/workspace/utils/resultRows/index.ts'
import { exportCSV } from '../src/utils/csv/index.ts'

test('numeric ordering preserves BIGINT, decimal, sign and exponent precision', () => {
  assert.ok(compareResultValues('9007199254740993', '9007199254740992', 'bigint') > 0)
  assert.ok(compareResultValues('0.10000000000000000001', '0.1', 'decimal(38,20)') > 0)
  assert.ok(compareResultValues('-10000000000000000000', '-2', 'numeric') < 0)
  assert.equal(compareResultValues('1.2e-3', '0.00120', 'double'), 0)
  assert.equal(compareResultValues('-0', '0.000', 'int'), 0)
  assert.ok(compareResultValues(null, '0', 'int') < 0)
})
test('sorting spans pages without changing original keys or source rows', () => {
  const rows = Array.from({ length: 120 }, (_, i) => [String(120 - i)])
  const original = structuredClone(rows),
    matches = [0, 50, 119]
  assert.deepEqual(sortResultRows(rows, matches, { column: 0, order: 'ascend' }, 'int'), [119, 50, 0])
  assert.deepEqual(matches, [0, 50, 119])
  const page = pageResultRows(rows, [], sortResultRows(rows, null, { column: 0, order: 'ascend' }, 'int'), 2)
  assert.equal(page[0].key, 69)
  assert.deepEqual(page[0].cells, ['51'])
  assert.deepEqual(rows, original)
  assert.equal(sortResultRows(rows, null), null)
})
test('selected export keeps cross-page keys, staged values and sorting, without unselected rows', () => {
  const rows = Array.from({ length: 100 }, (_, i) => [String(i), i === 50 ? 'staged' : 'original'])
  const output = selectedResultRows(rows, [50, 0, 99, 50, -1, 1000], { column: 0, order: 'descend' }, 'bigint')
  assert.deepEqual(output, [rows[99], rows[50], rows[0]])
  assert.equal(output[1][1], 'staged')
  assert.deepEqual(selectedResultRows(rows, []), [])
  assert.deepEqual(selectedResultRows([['999'], ['1']], [0, 1], { column: 0, order: 'ascend' }, 'int', [['1'], ['2']]), [['999'], ['1']])
})

test('CSV selected export contains a header and only the two chosen cross-page records', async (t) => {
  let blob,
    clicked = 0,
    attached = false,
    revoked = false
  const previousDocument = globalThis.document
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document
    else globalThis.document = previousDocument
  })
  globalThis.document = {
    body: {
      append() {
        attached = true
      }
    },
    createElement: () => ({
      click() {
        assert.ok(attached)
        clicked++
      },
      remove() {
        attached = false
      }
    })
  }
  t.mock.method(URL, 'createObjectURL', (value) => {
    blob = value
    return 'blob:fixture'
  })
  t.mock.method(URL, 'revokeObjectURL', () => {
    revoked = true
  })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const rows = Array.from({ length: 100 }, (_, i) => [String(i), 'record ' + i])
  exportCSV(['id', 'name'], selectedResultRows(rows, [0, 50]))
  const lines = (await blob.text()).replace(/^\uFEFF/, '').split('\r\n')
  assert.deepEqual(lines, ['"id","name"', '"0","record 0"', '"50","record 50"'])
  assert.equal(clicked, 1)
  assert.equal(attached, false)
  assert.equal(revoked, false)
  t.mock.timers.tick(1000)
  assert.equal(revoked, true)
})
