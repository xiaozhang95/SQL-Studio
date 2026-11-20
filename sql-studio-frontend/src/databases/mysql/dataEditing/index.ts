import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { originalRowFields } from '../../originalRow/index.ts'
import type { RowCellChange } from '../../typings/index.ts'

const name = (value: string) => '`' + value.replaceAll('`', '``') + '`'
const text = (value: unknown): string => {
  if (value === null) return 'NULL'
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('该值暂不支持编辑')
  const hex = Array.from(new TextEncoder().encode(String(value)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex ? "CONVERT(X'" + hex + "' USING utf8mb4)" : "''"
}
const unsupported = (column: Column) => /binary|blob|bit|geometry|point|polygon|linestring|vector/i.test(column.type)
const binaryType = /^(?:varbinary|binary|(?:tiny|medium|long)?blob|bit)\b/i
const spatialType = /^(?:(?:multi)?(?:point|polygon|linestring)|geometry(?:collection)?|vector)\b/i

function originalRowPredicates(columns: Column[], result: QueryResult, row: unknown[]) {
  return originalRowFields(columns, result, row).map(({ column, type, value }) => {
    const field = name(column.name)
    if (value === null) return `${field} IS NULL`
    if (binaryType.test(type)) {
      if (typeof value === 'string' && /^0x(?:[0-9a-f]{2})*$/i.test(value)) {
        const isBit = /^bit\b/i.test(column.type)
        if (type === 'BIT' && isBit && value.length > 2) return `(${field} + 0) <=> ${BigInt(value)}`
        if (type !== 'BIT' && !isBit && binaryType.test(column.type)) return `CAST(${field} AS BINARY) <=> X'${value.slice(2)}'`
      }
    } else if (type === 'FLOAT' || type === 'DOUBLE') {
      if (typeof value === 'number' && column.type.toUpperCase().startsWith(type)) {
        // The Go driver sends FLOAT as float32 JSON. Restore its value before comparing as DOUBLE.
        const original = type === 'FLOAT' ? Math.fround(value) : value
        if (Number.isFinite(original)) return `${field} <=> ${original.toExponential()}`
      }
    } else if (/^(?:UNSIGNED )?(?:TINYINT|SMALLINT|MEDIUMINT|INT|BIGINT|YEAR)$/.test(type)) {
      if (/^(?:tinyint|smallint|mediumint|int|bigint|year)\b/i.test(column.type) && /^-?\d+$/.test(String(value)) && (typeof value !== 'number' || Number.isSafeInteger(value))) {
        return `${field} <=> ${value}`
      }
    } else if (!binaryType.test(column.type) && !spatialType.test(column.type) && !spatialType.test(type)) {
      return `CAST(CONVERT(${field} USING utf8mb4) AS BINARY) <=> CAST(${text(value)} AS BINARY)`
    }
    throw new Error('原始行含有无法准确匹配的字段')
  })
}

export function deleteRowSQL(database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) {
  const keys = columns.filter((column) => column.key === 'PRI')
  const predicates = keys.length
    ? keys.map((column) => {
        const index = result.columns.findIndex((field) => field.name === column.name)
        if (index < 0 || row[index] == null || unsupported(column)) throw new Error('结果缺少可用主键，请重新打开表')
        return 'CAST(' + name(column.name) + ' AS BINARY) <=> CAST(' + text(row[index]) + ' AS BINARY)'
      })
    : originalRowPredicates(columns, result, row)
  return 'DELETE FROM ' + name(database) + '.' + name(table) + ' WHERE ' + predicates.join(' AND ') + ' LIMIT 1;'
}
export function updateRowSQL(database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], changes: readonly RowCellChange[]) {
  if (!changes.length) throw new Error('没有可保存的修改')
  const keys = columns.filter((item) => item.key === 'PRI')
  const fields = changes.map(({ columnIndex, value }) => {
    const field = columns.find((item) => item.name === result.columns[columnIndex]?.name)
    if (!field) throw new Error('表结构已变化，请放弃修改并重新打开表')
    if (!canInsertColumn(field)) throw new Error('二进制、空间类型和生成列暂不支持编辑')
    if (value === null && field.nullable !== 'YES') throw new Error('该字段不允许 NULL')
    return { field, value }
  })
  const assignments = fields.map(({ field, value }) => `${name(field.name)} = ${text(value)}`).join(', ')
  const predicates = keys.length
    ? [...new Set([...keys, ...fields.map(({ field }) => field)])].map((column) => {
        const index = result.columns.findIndex((item) => item.name === column.name)
        if (index < 0 || unsupported(column) || row[index] === undefined || (column.key === 'PRI' && row[index] === null)) throw new Error('结果缺少可用主键，请重新打开表')
        return 'CAST(' + name(column.name) + ' AS BINARY) <=> CAST(' + text(row[index]) + ' AS BINARY)'
      })
    : originalRowPredicates(columns, result, row)
  return `UPDATE ${name(database)}.${name(table)} SET ${assignments} WHERE ${predicates.join(' AND ')} LIMIT 1;`
}

export const canInsertColumn = (column: Column) => !unsupported(column) && !/(?:VIRTUAL|STORED) GENERATED/i.test(column.extra)
export function insertRowSQL(database: string, table: string, columns: Column[], result: QueryResult, values: unknown[]): string {
  const fields: string[] = []
  const literals: string[] = []
  for (const column of columns) {
    const index = result.columns.findIndex((item) => item.name === column.name)
    const value = index < 0 ? undefined : values[index]
    if (value === undefined) {
      if (column.nullable !== 'YES' && column.default === null && !/auto_increment|(?:VIRTUAL|STORED) GENERATED/i.test(column.extra)) throw new Error('请填写必填字段 ' + column.name)
      continue
    }
    if (!canInsertColumn(column)) throw new Error('字段 ' + column.name + ' 不支持手动新增值')
    if (value === null && column.nullable !== 'YES') throw new Error('字段 ' + column.name + ' 不允许 NULL')
    fields.push(name(column.name))
    literals.push(text(value))
  }
  return 'INSERT INTO ' + name(database) + '.' + name(table) + ' (' + fields.join(', ') + ') VALUES (' + literals.join(', ') + ');'
}
