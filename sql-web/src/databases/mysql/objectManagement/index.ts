import type { Column, QueryResult } from '@/typings/database'

import type { CollationOption, DatabaseObjectAdapter, FieldDefinition, ObjectFormValues, ObjectTarget } from '../../typings/objectManagement'
import { ObjectAction } from '../../typings/objectManagement/index.ts'
import { identifier } from '../query/index.ts'

const fieldTypes = ['BIGINT', 'INT', 'SMALLINT', 'TINYINT', 'DECIMAL(10,2)', 'DOUBLE', 'VARCHAR(255)', 'CHAR(36)', 'TEXT', 'LONGTEXT', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'JSON', 'BLOB'] as const
const typePattern =
  /^(?:BIGINT|INT|INTEGER|MEDIUMINT|SMALLINT|TINYINT|DECIMAL|NUMERIC|FLOAT|DOUBLE|REAL|BIT|BOOL|BOOLEAN|CHAR|VARCHAR|BINARY|VARBINARY|TINYTEXT|TEXT|MEDIUMTEXT|LONGTEXT|TINYBLOB|BLOB|MEDIUMBLOB|LONGBLOB|DATE|DATETIME|TIMESTAMP|TIME|YEAR|JSON|GEOMETRY|POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)(?:\(\d+(?:,\d+)?\))?(?: UNSIGNED)?(?: ZEROFILL)?$/i
const timestampPattern = /^CURRENT_TIMESTAMP(?:\([0-6]?\))?$/i
function name(value: string) {
  if (!value.trim() || Array.from(value).length > 64 || Array.from(value).some((char) => char.charCodeAt(0) < 32)) throw new Error('名称不能为空，最多 64 个字符，不能含控制字符')
  return identifier(value)
}
function option(value: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error('请选择有效字符集和排序规则')
  return value
}
function literal(value: string, mode: string) {
  const text = mode
    .toUpperCase()
    .split(',')
    .map((value) => value.trim())
    .includes('NO_BACKSLASH_ESCAPES')
    ? value
    : value.replaceAll('\\', '\\\\')
  return "'" + text.replaceAll("'", "''") + "'"
}
function hexText(value: string) {
  return 'CONVERT(0x' + Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, '0')).join('') + ' USING utf8mb4)'
}
function fieldSQL(field: FieldDefinition, mode: string) {
  if (field.locked || !typePattern.test(field.type.trim())) throw new Error(`字段 ${field.name} 的特殊定义暂不支持修改，请使用 SQL 编辑器`)
  if (field.autoIncrement && (!field.primary || !/^(?:BIGINT|INT|INTEGER|MEDIUMINT|SMALLINT|TINYINT)(?:\(\d+\))?(?: UNSIGNED)?$/i.test(field.type.trim())))
    throw new Error('自增字段必须是整数类型且属于主键')
  if (field.primary && field.nullable) throw new Error('主键字段不能允许 NULL')
  let sql = `${name(field.name)} ${field.type.trim()}`
  if (field.charset) sql += ' CHARACTER SET ' + option(field.charset)
  if (field.collation) sql += ' COLLATE ' + option(field.collation)
  sql += field.nullable ? ' NULL' : ' NOT NULL'
  if (field.defaultMode === 'null') {
    if (!field.nullable) throw new Error(`字段 ${field.name} 不允许 NULL 默认值`)
    sql += ' DEFAULT NULL'
  } else if (field.defaultMode === 'literal') {
    if (/^BIT(?:\(|$)/i.test(field.type)) {
      if (!/^[01]{1,64}$/.test(field.defaultValue)) throw new Error('BIT 默认值只能填写二进制位')
      sql += " DEFAULT b'" + field.defaultValue + "'"
    } else sql += ' DEFAULT ' + literal(field.defaultValue, mode)
  } else if (field.defaultMode === 'expression') {
    if (!timestampPattern.test(field.defaultValue)) throw new Error('默认表达式仅支持 CURRENT_TIMESTAMP 或 CURRENT_TIMESTAMP(精度)')
    sql += ' DEFAULT ' + field.defaultValue.toUpperCase()
  }
  if (field.autoIncrement) sql += ' AUTO_INCREMENT'
  if (field.extra) {
    if (!/^on update CURRENT_TIMESTAMP(?:\([0-6]?\))?$/i.test(field.extra)) throw new Error('此字段的额外属性暂不支持修改')
    sql += ' ' + field.extra
  }
  return sql + ' COMMENT ' + literal(field.comment, mode)
}
const editableShape = (field: FieldDefinition) =>
  JSON.stringify([field.name, field.type, field.nullable, field.autoIncrement, field.defaultMode, field.defaultValue, field.comment, field.extra, field.charset, field.collation])
function validateFields(fields: FieldDefinition[]) {
  if (!fields.length) throw new Error('表至少需要一个字段')
  const seen = new Set<string>()
  for (const field of fields) {
    name(field.name)
    const key = field.name.toLowerCase()
    if (seen.has(key)) throw new Error(`字段 ${field.name} 重复`)
    seen.add(key)
  }
  if (fields.filter((field) => field.autoIncrement).length > 1) throw new Error('只能有一个自增字段')
}
function tableSQL(action: ObjectAction, target: ObjectTarget, values: ObjectFormValues, original: FieldDefinition[], mode: string) {
  const table = `${name(target.database)}.${name(target.table || values.name)}`
  if (action === ObjectAction.DropTable) return `DROP ${target.view ? 'VIEW' : 'TABLE'} ${table};`
  if (action === ObjectAction.TruncateTable) return `TRUNCATE TABLE ${table};`
  if (action === ObjectAction.RenameTable && values.name === target.table) throw new Error('新名称与原名称相同')
  if (action === ObjectAction.RenameTable) return `RENAME TABLE ${table} TO ${name(target.database)}.${name(values.name)};`
  validateFields(values.fields)
  const primary = values.fields.filter((field) => field.primary).map((field) => name(field.name))
  if (action === ObjectAction.CreateTable) {
    const columns = values.fields.map((field) => fieldSQL(field, mode))
    if (primary.length) columns.push(`PRIMARY KEY (${primary.join(', ')})`)
    return `CREATE TABLE ${name(target.database)}.${name(values.name)} (\n  ${columns.join(',\n  ')}\n);`
  }
  const oldPrimary = original.filter((field) => field.primary).map((field) => field.name)
  const primaryChanged = JSON.stringify(oldPrimary) !== JSON.stringify(values.fields.filter((field) => field.primary).map((field) => field.name))
  const clauses: string[] = []
  if (primaryChanged && oldPrimary.length) clauses.push('DROP PRIMARY KEY')
  for (const old of original) {
    if (!values.fields.some((field) => field.originalName === old.originalName)) {
      if (old.locked) throw new Error(`特殊字段 ${old.name} 暂不支持删除`)
      clauses.push('DROP COLUMN ' + name(old.name))
    }
  }
  const matched = new Set<string>()
  for (const field of values.fields) {
    if (!field.originalName) {
      clauses.push('ADD COLUMN ' + fieldSQL(field, mode))
      continue
    }
    const old = original.find((value) => value.originalName === field.originalName)
    if (!old || matched.has(field.originalName)) throw new Error('字段原始标识无效，请重新打开设计表')
    matched.add(field.originalName)
    if (old.locked && editableShape(old) !== editableShape(field)) throw new Error(`特殊字段 ${old.name} 暂不支持修改`)
    if (editableShape(old) !== editableShape(field)) clauses.push(`CHANGE COLUMN ${name(old.name)} ${fieldSQL(field, mode)}`)
    if (old.locked && old.primary !== field.primary) throw new Error(`特殊字段 ${old.name} 暂不支持修改主键`)
  }
  if (primaryChanged && primary.length) clauses.push(`ADD PRIMARY KEY (${primary.join(', ')})`)
  if (!clauses.length) throw new Error('表结构没有变化')
  return `ALTER TABLE ${table}\n  ${clauses.join(',\n  ')};`
}
function fields(columns: Column[], ddl = ''): FieldDefinition[] {
  return columns.map((column) => {
    const declaration = ddl.split('\n').find((line) => line.trimStart().startsWith(identifier(column.name) + ' ')) || ''
    const attributes = declaration
      .trimStart()
      .slice(identifier(column.name).length)
      .match(/^\s+[a-z]+(?:\(\d+(?:,\d+)?\))?(?: UNSIGNED)?(?: ZEROFILL)?(?: CHARACTER SET ([a-zA-Z0-9_]+))?(?: COLLATE ([a-zA-Z0-9_]+))?/i)
    const special = /\b(?:COLUMN_FORMAT|STORAGE|ENGINE_ATTRIBUTE|SRID|CHECK|REFERENCES)\b/i.test(declaration)
    const extra = column.extra
      .replace(/DEFAULT_GENERATED/gi, '')
      .replace(/auto_increment/gi, '')
      .trim()
    const binaryDefault = column.default !== null && /^(?:bit|binary|varbinary|tinyblob|blob|mediumblob|longblob)(?:\(|$)/i.test(column.type)
    const generated = /DEFAULT_GENERATED/i.test(column.extra)
    const expression = /^(?:timestamp|datetime)/i.test(column.type) && column.default !== null && timestampPattern.test(column.default)
    return {
      originalName: column.name,
      name: column.name,
      type: column.type,
      nullable: column.nullable === 'YES',
      primary: column.key === 'PRI',
      autoIncrement: /auto_increment/i.test(column.extra),
      defaultMode: column.default === null ? (column.nullable === 'YES' ? 'null' : 'none') : expression ? 'expression' : 'literal',
      defaultValue: column.default || '',
      comment: column.comment,
      extra,
      charset: attributes?.[1],
      collation: attributes?.[2],
      locked: binaryDefault || special || !typePattern.test(column.type) || Boolean(extra && !/^on update CURRENT_TIMESTAMP(?:\([0-6]?\))?$/i.test(extra)) || Boolean(generated && !expression)
    }
  })
}
function rowCell(result: QueryResult, row: unknown[], column: string): string {
  const index = result.columns.findIndex((value) => value.name.toLowerCase() === column.toLowerCase())
  const value = row[index]
  if (typeof value !== 'string') throw new Error('元数据格式不正确：' + column)
  return value
}
export const mysqlObjects: DatabaseObjectAdapter = {
  fieldTypes,
  sameDefinition: (current, original) => {
    const normalize = (ddl: string) => ddl.replace(/(^\)\s+ENGINE=[^\n]*?)\bAUTO_INCREMENT=\d+\s*/im, '$1')
    return normalize(current) === normalize(original)
  },
  collationsSQL: 'SHOW COLLATION',
  sqlModeSQL: 'SELECT @@SESSION.sql_mode AS sql_mode',
  databaseInfoSQL: (database) => `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ${hexText(database)};`,
  databaseDefinition: (result) => {
    if (!result.rows.length) throw new Error('数据库不存在或无权访问')
    const row = result.rows[0]
    return { name: rowCell(result, row, 'SCHEMA_NAME'), charset: rowCell(result, row, 'DEFAULT_CHARACTER_SET_NAME'), collation: rowCell(result, row, 'DEFAULT_COLLATION_NAME') }
  },
  collations: (result) =>
    result.rows.map((row): CollationOption => ({
      name: rowCell(result, row, 'Collation'),
      charset: rowCell(result, row, 'Charset'),
      default: String(row[result.columns.findIndex((value) => value.name.toLowerCase() === 'default')]).toLowerCase() === 'yes'
    })),
  fields,
  defaultField: () => ({ name: '', type: 'VARCHAR(255)', nullable: true, primary: false, autoIncrement: false, defaultMode: 'none', defaultValue: '', comment: '', extra: '' }),
  sql: (action, target, values, original, mode) => {
    if (action === ObjectAction.CreateDatabase || action === ObjectAction.EditDatabase)
      return `${action === ObjectAction.CreateDatabase ? 'CREATE' : 'ALTER'} DATABASE ${name(action === ObjectAction.CreateDatabase ? values.name : target.database)} CHARACTER SET ${option(values.charset)} COLLATE ${option(values.collation)};`
    if (action === ObjectAction.DropDatabase) return `DROP DATABASE ${name(target.database)};`
    return tableSQL(action, target, values, original, mode)
  },
  dump: (database, table, ddl) =>
    `-- ${database.replace(/[\r\n]/g, ' ')} / ${table.replace(/[\r\n]/g, ' ')}\n-- 仅包含对象结构，不包含数据\nUSE ${name(database)};\n${ddl.trim().replace(/;+$/, '')};\n`
}
