import assert from 'node:assert/strict'
import test from 'node:test'

import { indexDescription, objectNodeKey } from '../src/pages/workspace/utils/objectTree/index.ts'

test('tree keys preserve explicit scope and names containing separators', () => {
  const key = objectNodeKey('index', 'connection-a', 'shared.db', 'a/b', 'idx_"value')
  assert.deepEqual(JSON.parse(key), ['index', 'connection-a', 'shared.db', 'a/b', 'idx_"value'])
  assert.notEqual(key, objectNodeKey('index', 'connection-b', 'shared.db', 'a/b', 'idx_"value'))
})

test('index description retains composite order, prefix, direction and unknown expression', () => {
  const index = {
    name: 'idx_user_date',
    type: 'BTREE',
    unique: false,
    columns: [
      { name: 'bill_date', position: 2, prefixLength: 12, order: 'D' },
      { name: 'user_id', position: 1, prefixLength: null, order: 'A' }
    ]
  }
  assert.equal(indexDescription(index), '普通索引 · BTREE\nuser_id, bill_date(12) DESC')
  assert.equal(index.columns[0].name, 'bill_date')
  assert.match(indexDescription({ ...index, name: 'PRIMARY', unique: true }), /^主键/)
  assert.equal(indexDescription({ name: 'unique_expression', type: 'BTREE', unique: true, columns: [{ name: '', position: 1, prefixLength: null, order: '' }] }), '唯一索引 · BTREE\n(表达式)')
})
