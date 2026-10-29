import assert from 'node:assert/strict'
import test from 'node:test'

import { mariadbCompletion } from '../src/databases/mariadb/completion/index.ts'
import { mariadbObjects } from '../src/databases/mariadb/objectManagement/index.ts'
import { splitMariaDBStatements, useMariaDBDatabase } from '../src/databases/mariadb/statements/index.ts'
import { ObjectAction } from '../src/databases/typings/objectManagement/index.ts'

test('MariaDB scripts preserve vendor comments and quoted semicolons without misidentifying USE', () => {
  assert.equal(splitMariaDBStatements("/*M! SET @n=1 */; SELECT 'a;b'; /*! SET @n=2 */;").length, 3)
  assert.equal(splitMariaDBStatements('/* ordinary */').length, 0)
  assert.equal(useMariaDBDatabase('USE `a``b`;'), 'a`b')
  assert.equal(useMariaDBDatabase('USE db /*M! SET @x=1 */;'), undefined)
  assert.throws(() => splitMariaDBStatements("SELECT 'unfinished"), /未闭合/)
  assert.ok(mariadbCompletion({ database: 'db', table: '', schema: {} }))
})

test('MariaDB field defaults distinguish NULL strings, SQL NULL and expressions', () => {
  const defaults = ["'NULL'", 'NULL', null, "'it''s 中文'", '5', 'current_timestamp()', 'uuid()', "'a\\nb'"]
  const columns = defaults.map((value, i) => ({ name: 'c' + i, type: i === 5 ? 'timestamp' : 'varchar(100)', nullable: 'YES', key: '', default: value, extra: '', comment: '' }))
  const fields = mariadbObjects.fields(columns)
  assert.equal(fields[0].defaultMode, 'literal')
  assert.equal(fields[0].defaultValue, 'NULL')
  assert.equal(fields[1].defaultMode, 'null')
  assert.equal(fields[2].defaultMode, 'null')
  assert.equal(fields[3].defaultValue, "it's 中文")
  assert.equal(fields[4].defaultValue, '5')
  assert.equal(fields[5].defaultMode, 'expression')
  assert.equal(fields[6].locked, true)
  assert.equal(fields[7].locked, true)
  const changed = fields.map((field, i) => (i === 3 ? { ...field, comment: 'changed' } : field))
  const sql = mariadbObjects.sql(ObjectAction.EditTable, { database: 'db', table: 'sample', connectionId: 'mariadb' }, { name: 'sample', fields: changed }, fields, '')
  assert.match(sql, /DEFAULT 'it''s 中文'/)
  assert.ok(!sql.includes("DEFAULT 'uuid()'"))
})

test('MariaDB collation aliases without a charset do not break database forms', () => {
  const options = mariadbObjects.collations({
    columns: [{ name: 'Collation' }, { name: 'Charset' }, { name: 'Default' }],
    rows: [
      ['uca1400_ai_ci', null, null],
      ['utf8mb4_general_ci', 'utf8mb4', 'Yes']
    ]
  })
  assert.deepEqual(options, [{ name: 'utf8mb4_general_ci', charset: 'utf8mb4', default: true }])
  assert.match(mariadbObjects.collationsSQL, /FULL_COLLATION_NAME/)
  assert.equal(mariadbObjects.defaultCollation([{ name: 'big5_chinese_ci', charset: 'big5', default: true }, ...options]).charset, 'utf8mb4')
})
