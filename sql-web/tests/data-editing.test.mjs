import assert from 'node:assert/strict'
import test from 'node:test'

import { insertRowSQL, updateCellSQL } from '../src/databases/mysql/dataEditing/index.ts'

const columns = [
  { name: 'id', type: 'bigint', key: 'PRI', nullable: 'NO', extra: '' },
  { name: 'name', type: 'varchar(255)', key: '', nullable: 'YES', extra: '' }
]
const result = { columns: columns.map((column) => ({ name: column.name, type: column.type })) }
const row = ['9007199254740993123', '原值']
const sql = (value, fields = columns, data = row, index = 1) => updateCellSQL('db`', 'tab`', fields, result, data, index, value)
test('explicit scope and precision key; values cannot inject SQL', () => {
  const value = "中文'; DROP TABLE t; --\\"
  const output = sql(value)
  assert.ok(output.startsWith('UPDATE `db```.`tab``` SET'))
  assert.ok(!output.includes('DROP TABLE'))
  assert.ok(output.includes(Buffer.from(row[0]).toString('hex')))
  assert.ok(output.includes(Buffer.from(value).toString('hex')))
  assert.ok(output.includes('CAST(`id` AS BINARY) <=> CAST'))
  assert.ok(output.includes('AND CAST(`name` AS BINARY) <=> CAST'))
  assert.ok(output.endsWith(' LIMIT 1;'))
})
test('NULL, empty text and nullable constraints are distinct', () => {
  assert.ok(sql(null).includes('SET `name` = NULL WHERE'))
  assert.ok(sql('').includes("SET `name` = '' WHERE"))
  assert.throws(() => sql(null, columns, row, 0), /不允许 NULL/)
  assert.ok(sql('new', columns, [row[0], null]).includes('CAST(NULL AS BINARY)'))
})
test('requires complete primary keys including compound keys', () => {
  assert.throws(
    () =>
      sql(
        'x',
        columns.map((c) => ({ ...c, key: '' }))
      ),
    /主键/
  )
  assert.throws(() => sql('x', [...columns, { name: 'missing', key: 'PRI', type: 'int' }]), /主键/)
  const output = sql(
    'x',
    columns.map((c) => ({ ...c, key: 'PRI' }))
  )
  assert.equal(output.split('CAST(`name` AS BINARY)').length, 2)
})
test('reject unsupported/generated fields; allow default generated timestamps', () => {
  for (const change of [{ type: 'blob' }, { type: 'geometry' }, { extra: 'STORED GENERATED' }]) assert.throws(() => sql('x', [columns[0], { ...columns[1], ...change }]), /不支持/)
  assert.doesNotThrow(() => sql('2026-10-26 12:00:00', [columns[0], { ...columns[1], type: 'timestamp', extra: 'DEFAULT_GENERATED' }]))
})

test('new rows omit auto/default columns, preserve explicit NULL/empty and require mandatory values', () => {
  const fields = [
    { ...columns[0], extra: 'auto_increment', default: null },
    { ...columns[1], default: null }
  ]
  assert.equal(insertRowSQL('db', 't', fields, result, [undefined, '']), "INSERT INTO `db`.`t` (`name`) VALUES ('');")
  assert.ok(insertRowSQL('db', 't', fields, result, [undefined, null]).includes('VALUES (NULL)'))
  assert.throws(
    () =>
      insertRowSQL(
        'db',
        't',
        fields.map((c) => ({ ...c, extra: '' })),
        result,
        [undefined, 'a']
      ),
    /必填/
  )
  assert.throws(() => insertRowSQL('db', 't', fields, result, [null, 'a']), /不允许 NULL/)
})
