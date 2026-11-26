import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { originalRowFields } from '../../originalRow/index.ts'
import type { RowCellChange } from '../../typings/index.ts'
import { identifier, relation, textLiteral } from '../query/index.ts'

const text = /^(?:N?VARCHAR2?|N?CHAR)(?:\(|$)/i
const numeric = /^(?:NUMBER|FLOAT|BINARY_FLOAT|BINARY_DOUBLE|DECIMAL|INTEGER|SMALLINT)(?:\(|$)/i
const timestamp = /^TIMESTAMP(?:\(\d+\))?(?: WITH (?:LOCAL )?TIME ZONE)?$/i
const raw = /^RAW(?:\(|$)/i
const date = /^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/
const time = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/
const timeWithZone = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?$/i

const comparisonSupported = (type: string) => text.test(type) || numeric.test(type) || raw.test(type) || timestamp.test(type) || /^(?:DATE|BOOLEAN)$/i.test(type)
export const generated = (column: Column) => /\bGENERATED\b/.test(column.extra)
export const canInsertColumn = (column: Column) => comparisonSupported(column.type) && !generated(column)

export function sqlValue(type: string, value: unknown): string {
  if (value === null) return 'NULL'
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') throw new Error('该值暂不支持编辑')
  const entered = String(value)
  if (text.test(type)) {
    if (entered.includes('\0') || new TextEncoder().encode(entered).length > 4000) throw new Error('Oracle 字符值太长或含有空字符，请使用 SQL 编辑器')
    return (type.toUpperCase().startsWith('N') ? 'N' : '') + textLiteral(entered)
  }
  if (numeric.test(type)) {
    const binaryType = type.toUpperCase()
    if (binaryType === 'BINARY_FLOAT' || binaryType === 'BINARY_DOUBLE') {
      if (entered === 'NaN') return binaryType + '_NAN'
      if (entered === '+Inf' || entered === '-Inf') return (entered[0] === '-' ? '-' : '') + binaryType + '_INFINITY'
    }
    if (!number.test(entered) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('请输入有效的 Oracle 数值')
    if (/^BINARY_FLOAT$/i.test(type)) return entered + 'f'
    if (/^BINARY_DOUBLE$/i.test(type)) return entered + 'd'
    return entered
  }
  if (type === 'DATE' && date.test(entered)) return `TO_DATE(${textLiteral(entered)}, 'YYYY-MM-DD${entered.length > 10 ? ' HH24:MI:SS' : ''}')`
  if (timestamp.test(type)) {
    if (!/TIME ZONE/i.test(type) && time.test(entered)) return `TIMESTAMP ${textLiteral(entered.replace('T', ' '))}`
    if (/TIME ZONE/i.test(type) && timeWithZone.test(entered)) {
      const normalized = entered.replace('T', ' ').replace(/Z$/, '+00:00')
      const format = 'YYYY-MM-DD HH24:MI:SS' + (normalized.includes('.') ? '.FF' : '') + 'TZH:TZM'
      return `TO_TIMESTAMP_TZ(${textLiteral(normalized)}, '${format}')`
    }
  }
  if (raw.test(type) && /^(?:0x)?(?:[0-9a-f]{2}){1,2000}$/i.test(entered)) return `HEXTORAW(${textLiteral(entered.replace(/^0x/i, ''))})`
  if (type === 'BOOLEAN' && /^(true|false)$/i.test(entered)) return entered.toUpperCase()
  throw new Error('该值暂不支持编辑')
}

function predicate(column: Column, value: unknown) {
  if (value === null) return identifier(column.name) + ' IS NULL'
  if (!comparisonSupported(column.type) || value === undefined || (numeric.test(column.type) && typeof value === 'number' && !/^BINARY_/i.test(column.type))) {
    throw new Error('原始行含有无法准确匹配的字段')
  }
  return identifier(column.name) + ' = ' + sqlValue(column.type, value)
}

function whereRow(table: string, columns: Column[], result: QueryResult, row: unknown[], updated: Column[] = []) {
  const keys = columns.filter((column) => column.key === 'PRI')
  if (!keys.length) {
    const predicates = originalRowFields(columns, result, row).map(({ column, value }) => predicate(column, value))
    return `ROWID = (SELECT ROWID FROM ${table} WHERE ${predicates.join(' AND ')} AND ROWNUM = 1)`
  }
  return [...new Set([...keys, ...updated])]
    .map((column) => {
      const index = result.columns.findIndex((field) => field.name === column.name)
      if (index < 0 || (column.key === 'PRI' && row[index] == null)) throw new Error('结果缺少可用主键，请重新打开表')
      return predicate(column, row[index])
    })
    .join(' AND ')
}

function checkedValue(column: Column, value: unknown) {
  if (!canInsertColumn(column)) throw new Error('该字段由数据库生成或暂不支持编辑')
  if ((value === null || (text.test(column.type) && value === '')) && column.nullable !== 'YES') throw new Error('该字段不允许 NULL')
  return sqlValue(column.type, value)
}

export function updateRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], changes: readonly RowCellChange[]) {
  if (!changes.length) throw new Error('没有可保存的修改')
  const target = relation(table)
  const fields = changes.map(({ columnIndex, value }) => {
    const column = columns.find((field) => field.name === result.columns[columnIndex]?.name)
    if (!column) throw new Error('表结构已变化，请放弃修改并重新打开表')
    return { column, assignment: identifier(column.name) + ' = ' + checkedValue(column, value) }
  })
  return `UPDATE ${target} SET ${fields.map(({ assignment }) => assignment).join(', ')} WHERE ${whereRow(
    target,
    columns,
    result,
    row,
    fields.map(({ column }) => column)
  )};`
}

export function deleteRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) {
  const target = relation(table)
  return `DELETE FROM ${target} WHERE ${whereRow(target, columns, result, row)};`
}

export function insertRowSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) {
  const fields: string[] = []
  const values: string[] = []
  for (const column of columns) {
    const index = result.columns.findIndex((field) => field.name === column.name)
    const value = index < 0 ? undefined : row[index]
    if (value === undefined) {
      if (column.nullable !== 'YES' && column.default === null && !generated(column)) throw new Error('请填写必填字段 ' + column.name)
      continue
    }
    values.push(checkedValue(column, value))
    fields.push(identifier(column.name))
  }
  if (!fields.length) {
    const first = columns.find((column) => !column.extra.includes('VIRTUAL'))
    if (!first) throw new Error('没有可写入的字段')
    fields.push(identifier(first.name))
    values.push('DEFAULT')
  }
  return `INSERT INTO ${relation(table)} (${fields.join(', ')}) VALUES (${values.join(', ')});`
}
