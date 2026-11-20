import assert from 'node:assert/strict'
import test from 'node:test'

import { insertRowSQL, updateRowSQL } from '../src/databases/mysql/dataEditing/index.ts'

const columns = [
  { name: 'id', type: 'bigint', key: 'PRI', nullable: 'NO', extra: '' },
  { name: 'name', type: 'varchar(255)', key: '', nullable: 'YES', extra: '' }
]
const result = { columns: columns.map((column) => ({ name: column.name, type: column.type })) }
const row = ['9007199254740993123', '原值']
const sql = (value, fields = columns, data = row, index = 1) => updateRowSQL('db`', 'tab`', fields, result, data, [{ columnIndex: index, value }])
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
  assert.throws(() => sql('x', [...columns, { name: 'missing', key: 'PRI', type: 'int' }]), /主键/)
  const output = sql(
    'x',
    columns.map((c) => ({ ...c, key: 'PRI' }))
  )
  assert.equal(output.split('CAST(`name` AS BINARY)').length, 2)
})
test('without a primary key, one update saves all changes against a complete original row', () => {
  const fields = [{ ...columns[0], key: '' }, columns[1], { name: 'created_at', type: 'timestamp(6)', nullable: 'YES', extra: '', key: '' }]
  const snapshot = {
    columns: [
      { name: 'id', type: 'BIGINT' },
      { name: 'name', type: 'VARCHAR' },
      { name: 'created_at', type: 'TIMESTAMP' }
    ]
  }
  const original = [row[0], null, '2026-11-20 13:45:00.123456']
  const changes = [
    { columnIndex: 1, value: '中文' },
    { columnIndex: 2, value: null }
  ]
  const output = updateRowSQL('db', 't', fields, snapshot, original, changes)
  assert.ok(output.startsWith("UPDATE `db`.`t` SET `name` = CONVERT(X'e4b8ade69687' USING utf8mb4), `created_at` = NULL WHERE "))
  assert.ok(output.includes('`id` <=> 9007199254740993123 AND `name` IS NULL AND CAST(CONVERT(`created_at` USING utf8mb4) AS BINARY)'))
  assert.ok(output.endsWith(' LIMIT 1;'))
  assert.throws(() => updateRowSQL('db', 't', fields, snapshot, original.slice(0, 2), changes), /完整的原始行数据/)
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
