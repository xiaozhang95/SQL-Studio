import assert from 'node:assert/strict'
import test from 'node:test'

import { mysqlObjects } from '../src/databases/mysql/objectManagement/index.ts'
import { ObjectAction } from '../src/databases/typings/objectManagement/index.ts'

const target = { connectionId: 'a', database: 'db`name', table: 'old`table' }
const values = () => ({
  name: 'new`name',
  charset: 'utf8mb4',
  collation: 'utf8mb4_general_ci',
  fields: [{ ...mysqlObjects.defaultField(), name: 'id', type: 'BIGINT', primary: true, nullable: false, autoIncrement: true }],
  confirmation: ''
})
const sql = (action, form = values(), original = [], mode = '') => mysqlObjects.sql(action, target, form, original, mode)

test('object SQL quotes its explicit target; database names are independent of the active page', () => {
  assert.equal(sql(ObjectAction.DropDatabase), 'DROP DATABASE `db``name`;')
  assert.equal(sql(ObjectAction.DropTable), 'DROP TABLE `db``name`.`old``table`;')
  assert.equal(sql(ObjectAction.TruncateTable), 'TRUNCATE TABLE `db``name`.`old``table`;')
  assert.equal(sql(ObjectAction.RenameTable), 'RENAME TABLE `db``name`.`old``table` TO `db``name`.`new``name`;')
  assert.equal(sql(ObjectAction.CreateDatabase), 'CREATE DATABASE `new``name` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;')
  assert.match(sql(ObjectAction.CreateTable), /^CREATE TABLE `db``name`\.`new``name`/)
})
test('field definitions reject SQL fragments, invalid keys and duplicate names', () => {
  let input = values()
  input.fields[0].type = 'INT); DROP TABLE secrets; --'
  assert.throws(() => sql(ObjectAction.CreateTable, input), /特殊定义/)
  input = values()
  input.fields[0].nullable = true
  assert.throws(() => sql(ObjectAction.CreateTable, input), /主键字段/)
  input = values()
  input.fields.push({ ...input.fields[0], name: 'ID', autoIncrement: false })
  assert.throws(() => sql(ObjectAction.CreateTable, input), /重复/)
  input = values()
  input.fields[0].defaultMode = 'expression'
  input.fields[0].defaultValue = 'CURRENT_TIMESTAMP; DROP DATABASE x'
  assert.throws(() => sql(ObjectAction.CreateTable, input), /仅支持/)
  input = values()
  input.charset = 'utf8mb4;DROP DATABASE x'
  assert.throws(() => sql(ObjectAction.CreateDatabase, input), /请选择/)
})
test('comments and string defaults respect the loaded SQL mode', () => {
  const input = values()
  input.fields[0].comment = "quote' slash\\"
  const normal = sql(ObjectAction.CreateTable, input)
  assert.ok(normal.includes("COMMENT 'quote'' slash\\\\'"))
  const noEscape = sql(ObjectAction.CreateTable, input, [], 'STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES')
  assert.ok(noEscape.includes("COMMENT 'quote'' slash\\'"))
})
test('ALTER preserves untouched fields and does not recreate tables or secondary indexes', () => {
  const original = mysqlObjects.fields([
    { name: 'id', type: 'bigint', nullable: 'NO', key: 'PRI', default: null, extra: 'auto_increment', comment: '' },
    { name: 'title', type: 'varchar(50)', nullable: 'YES', key: 'UNI', default: null, extra: '', comment: '' }
  ])
  const input = values()
  input.fields = structuredClone(original)
  input.fields[1].comment = 'new comment'
  const statement = sql(ObjectAction.EditTable, input, original)
  assert.match(statement, /CHANGE COLUMN `title`/)
  assert.doesNotMatch(statement, /CHANGE COLUMN `id`|DROP TABLE|CREATE TABLE|DROP INDEX/)
  input.fields = structuredClone(original)
  assert.throws(() => sql(ObjectAction.EditTable, input, original), /没有变化/)
})

test('metadata types match design choices without losing precision or changing opaque type literals', () => {
  const types = ['bigint unsigned', 'datetime', 'decimal(19,4)', 'varchar(80)', "enum('KeepCase','lower')"]
  const original = mysqlObjects.fields(types.map((type, i) => ({ name: 'c' + i, type, nullable: 'YES', key: '', default: null, extra: '', comment: '' })))
  assert.deepEqual(
    original.map((field) => field.type),
    ['BIGINT UNSIGNED', 'DATETIME', 'DECIMAL(19,4)', 'VARCHAR(80)', types[4]]
  )
  assert.equal(original[4].locked, true)
  const input = values()
  input.fields = structuredClone(original)
  input.fields[1].type = mysqlObjects.fieldTypes.find((type) => type === 'DATETIME')
  assert.throws(() => sql(ObjectAction.EditTable, input, original), /没有变化/)
})
test('column collations are preserved while unsupported generated definitions remain locked', () => {
  const columns = [{ name: 'code', type: 'varchar(50)', nullable: 'YES', key: '', default: null, extra: '', comment: '' }]
  const fields = mysqlObjects.fields(columns, 'CREATE TABLE `t` (\n  `code` varchar(50) COLLATE utf8mb4_bin DEFAULT NULL\n)')
  assert.equal(fields[0].locked, false)
  assert.equal(fields[0].collation, 'utf8mb4_bin')
  const collated = values()
  collated.fields = structuredClone(fields)
  collated.fields[0].comment = 'keep collation'
  assert.match(sql(ObjectAction.EditTable, collated, fields), /COLLATE utf8mb4_bin/)
  fields[0].locked = true
  const input = values()
  input.fields = structuredClone(fields)
  input.fields[0].name = 'renamed'
  assert.throws(() => sql(ObjectAction.EditTable, input, fields), /特殊字段/)
  input.fields = []
  assert.throws(() => sql(ObjectAction.EditTable, input, fields), /至少/)
  assert.equal(mysqlObjects.fields([{ ...columns[0], extra: 'VIRTUAL GENERATED' }])[0].locked, true)
})
test('timestamp defaults are expressions only for temporal columns; structure dumps contain no destructive statements', () => {
  const base = { name: 'v', type: 'varchar(50)', nullable: 'YES', key: '', default: 'CURRENT_TIMESTAMP', extra: '', comment: '' }
  assert.equal(mysqlObjects.fields([base])[0].defaultMode, 'literal')
  assert.equal(mysqlObjects.fields([{ ...base, type: 'timestamp', extra: 'DEFAULT_GENERATED' }])[0].defaultMode, 'expression')
  const dump = mysqlObjects.dump('db`name', 't', 'CREATE TABLE `t` (`id` INT);')
  assert.match(dump, /USE `db``name`;/)
  assert.match(dump, /CREATE TABLE/)
  assert.doesNotMatch(dump, /DROP|INSERT/)
})

test('key replacement and column removal are one ALTER and preserve other constraints', () => {
  const original = mysqlObjects.fields([
    { name: 'id', type: 'bigint', nullable: 'NO', key: 'PRI', default: null, extra: 'auto_increment', comment: '' },
    { name: 'title', type: 'varchar(50)', nullable: 'YES', key: 'UNI', default: null, extra: '', comment: '' }
  ])
  const input = values()
  input.fields = [structuredClone(original[1]), { ...mysqlObjects.defaultField(), name: 'new_id', type: 'BIGINT', primary: true, nullable: false, autoIncrement: true }]
  const statement = sql(ObjectAction.EditTable, input, original)
  assert.match(statement, /ALTER TABLE.*\n  DROP PRIMARY KEY,\n  DROP COLUMN `id`,/)
  assert.match(statement, /ADD PRIMARY KEY \(`new_id`\)/)
  assert.doesNotMatch(statement, /DROP INDEX|CREATE TABLE/)
})
test('view deletion uses DROP VIEW; unchanged rename and invalid NULL defaults are rejected', () => {
  assert.equal(mysqlObjects.sql(ObjectAction.DropTable, { ...target, view: true }, values(), [], ''), 'DROP VIEW `db``name`.`old``table`;')
  const input = values()
  input.name = target.table
  assert.throws(() => sql(ObjectAction.RenameTable, input), /原名称相同/)
  input.fields[0].defaultMode = 'null'
  assert.throws(() => sql(ObjectAction.CreateTable, input), /不允许 NULL/)
})

test('BIT literals are generated as bits; opaque existing binary defaults cannot be silently rewritten', () => {
  const input = values()
  input.fields = [{ ...mysqlObjects.defaultField(), name: 'flag', type: 'BIT(1)', defaultMode: 'literal', defaultValue: '1' }]
  assert.match(sql(ObjectAction.CreateTable, input), /DEFAULT b'1'/)
  input.fields[0].defaultValue = '2'
  assert.throws(() => sql(ObjectAction.CreateTable, input), /二进制位/)
  const column = { name: 'flag', type: 'bit(1)', nullable: 'YES', key: '', default: "b'1'", extra: '', comment: '' }
  assert.equal(mysqlObjects.fields([column])[0].locked, true)
})

test('long-lived table designers ignore the volatile table auto-increment counter but detect schema changes', () => {
  const a = "CREATE TABLE `t` (\n `id` bigint COMMENT 'AUTO_INCREMENT=1'\n) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4;"
  assert.equal(mysqlObjects.sameDefinition(a, a.replace('AUTO_INCREMENT=10', 'AUTO_INCREMENT=11')), true)
  assert.equal(mysqlObjects.sameDefinition(a, a.replace('bigint', 'int')), false)
  assert.equal(mysqlObjects.sameDefinition(a, a.replace("COMMENT 'AUTO_INCREMENT=1'", "COMMENT 'AUTO_INCREMENT=2'")), false)
})
