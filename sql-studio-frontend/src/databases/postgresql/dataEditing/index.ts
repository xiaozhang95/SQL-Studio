import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { originalRowFields } from '../../originalRow/index.ts'
import type { RowCellChange } from '../../typings/index.ts'
import { identifier, literal, relation } from '../query/index.ts'

const unsupported = (column: Column) => /bytea|\[\]|geometry|geography|vector|range|record|^bit/i.test(column.type)

function originalRowPredicates(columns: Column[], result: QueryResult, row: unknown[]) {
  return originalRowFields(columns, result, row).map(({ column, type, value }) => {
    const field = identifier(column.name)
    if (value === null) return `${field} IS NULL`
    if (/^(?:BOOL|DATE|TIMESTAMP|TIMESTAMPTZ|FLOAT4|FLOAT8|BYTEA)$/.test(type)) {
      return `${field} IS NOT DISTINCT FROM ${literal(value)}::pg_catalog.${type.toLowerCase()}`
    }
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('原始行含有无法准确匹配的字段')
    return `pg_catalog.format('%s', ${field}) COLLATE pg_catalog."C" = ${literal(value)}`
  })
}

function matchOriginalRow(target: string, columns: Column[], result: QueryResult, row: unknown[], forUpdate = false) {
  const predicates = originalRowPredicates(columns, result, row).join(' AND ')
  // tableoid distinguishes child tables whose physical row locations can coincide.
  return `(SELECT tableoid, ctid FROM ${target} WHERE ${predicates} LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}) AS matched WHERE target.tableoid = matched.tableoid AND target.ctid = matched.ctid`
}

export function deleteRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) {
  const target = relation(table)
  const keys = columns.filter((column) => column.key === 'PRI')
  if (!keys.length) {
    return `DELETE FROM ${target} AS target USING ${matchOriginalRow(target, columns, result, row)};`
  }
  const predicates = keys.map((column) => {
    const index = result.columns.findIndex((field) => field.name === column.name)
    if (index < 0 || row[index] == null || unsupported(column)) throw new Error('结果缺少可用主键，请重新打开表')
    return `${identifier(column.name)} IS NOT DISTINCT FROM ${literal(row[index])}`
  })
  return `DELETE FROM ${target} WHERE ${predicates.join(' AND ')};`
}
export const canInsertColumn = (column: Column) => !unsupported(column) && !/GENERATED|IDENTITY/i.test(column.extra)
export function updateRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], changes: readonly RowCellChange[]) {
  if (!changes.length) throw new Error('没有可保存的修改')
  const target = relation(table)
  const keys = columns.filter((column) => column.key === 'PRI')
  const fields = changes.map(({ columnIndex, value }) => {
    const field = columns.find((column) => column.name === result.columns[columnIndex]?.name)
    if (!field) throw new Error('表结构已变化，请放弃修改并重新打开表')
    if (!canInsertColumn(field)) throw new Error('该字段由数据库生成或暂不支持编辑')
    if (value === null && field.nullable !== 'YES') throw new Error('该字段不允许 NULL')
    return { field, value }
  })
  const assignments = fields.map(({ field, value }) => `${identifier(field.name)} = ${literal(value)}`).join(', ')
  if (!keys.length) return `UPDATE ${target} AS target SET ${assignments} FROM ${matchOriginalRow(target, columns, result, row, true)};`
  const predicates = [...new Set([...keys, ...fields.map(({ field }) => field)])].map((column) => {
    const index = result.columns.findIndex((item) => item.name === column.name)
    if (index < 0 || row[index] === undefined || unsupported(column) || (column.key === 'PRI' && row[index] === null)) throw new Error('结果缺少可用主键，请重新打开表')
    return `${identifier(column.name)} IS NOT DISTINCT FROM ${literal(row[index])}`
  })
  return `UPDATE ${target} SET ${assignments} WHERE ${predicates.join(' AND ')};`
}
export function insertRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, values: unknown[]) {
  const fields: string[] = [],
    literals: string[] = []
  for (const column of columns) {
    const index = result.columns.findIndex((item) => item.name === column.name),
      value = index < 0 ? undefined : values[index]
    if (value === undefined) {
      if (column.nullable !== 'YES' && column.default === null && !/GENERATED|IDENTITY/i.test(column.extra)) throw new Error('请填写必填字段 ' + column.name)
      continue
    }
    if (!canInsertColumn(column)) throw new Error('字段不支持手动新增值')
    if (value === null && column.nullable !== 'YES') throw new Error('字段不允许 NULL')
    fields.push(identifier(column.name))
    literals.push(literal(value))
  }
  return fields.length ? `INSERT INTO ${relation(table)} (${fields.join(', ')}) VALUES (${literals.join(', ')});` : `INSERT INTO ${relation(table)} DEFAULT VALUES;`
}
