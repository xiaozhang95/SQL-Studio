import assert from 'node:assert/strict'
import test from 'node:test'

import { dumpData } from '../src/databases/mysql/dataDump/index.ts'

const result = {
  columns: [
    { name: 'id', type: 'BIGINT' },
    { name: 'text', type: 'VARCHAR' },
    { name: 'blob', type: 'BLOB' },
    { name: 'calc', type: 'INT' }
  ],
  rows: [['9007199254740993', "中文'; DROP TABLE x", '0x00ff', '2']],
  truncated: false
}
const columns = [{ name: 'calc', extra: 'STORED GENERATED' }]
test('dump preserves large numbers, encodes text and binary and skips generated fields', () => {
  const sql = dumpData('a`', 'b', result, columns)
  assert.ok(sql.includes('9007199254740993'))
  assert.ok(sql.includes('0x00ff'))
  assert.ok(!sql.includes('DROP TABLE'))
  assert.ok(!sql.includes('`calc`'))
  assert.ok(sql.startsWith('INSERT INTO `a```.`b`'))
})
test('truncated results never produce a partial dump', () => assert.throws(() => dumpData('a', 'b', { ...result, truncated: true }, columns), /限制/))
test('NULL and empty text remain distinct', () => {
  const sql = dumpData(
    'a',
    'b',
    {
      columns: [
        { name: 'a', type: 'VARCHAR' },
        { name: 'b', type: 'TEXT' }
      ],
      rows: [[null, '']],
      truncated: false
    },
    []
  )
  assert.ok(sql.includes("VALUES (NULL, '');"))
})
