import type { Column, QueryResult } from '../../../typings/database/index.ts'

const name = (value: string) => '`' + value.replaceAll('`', '``') + '`'
const text = (value: unknown): string => {
  if (value === null) return 'NULL'
  if (!['string', 'number', 'boolean'].includes(typeof value)) throw new Error('该值暂不支持编辑')
  const hex = Array.from(new TextEncoder().encode(String(value)), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return hex ? "CONVERT(X'" + hex + "' USING utf8mb4)" : "''"
}
const unsupported = (column: Column) => /binary|blob|bit|geometry|point|polygon|linestring|vector/i.test(column.type)
export function deleteRowSQL(database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) {
  const keys = columns.filter((column) => column.key === 'PRI')
  if (!keys.length) throw new Error('没有完整主键，无法安全删除这张表的数据')
  const predicates = keys.map((column) => {
    const index = result.columns.findIndex((field) => field.name === column.name)
    if (index < 0 || row[index] == null || unsupported(column)) throw new Error('结果缺少可用主键，请重新打开表')
    return 'CAST(' + name(column.name) + ' AS BINARY) <=> CAST(' + text(row[index]) + ' AS BINARY)'
  })
  return 'DELETE FROM ' + name(database) + '.' + name(table) + ' WHERE ' + predicates.join(' AND ') + ' LIMIT 1;'
}
export function updateCellSQL(database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], columnIndex: number, value: string | null) {
  const field = columns.find((item) => item.name === result.columns[columnIndex]?.name)
  const keys = columns.filter((item) => item.key === 'PRI')
  if (!field || !keys.length) throw new Error('没有完整主键，无法安全编辑这张表')
  if (unsupported(field) || /(?:VIRTUAL|STORED) GENERATED/i.test(field.extra)) throw new Error('二进制、空间类型和生成列暂不支持编辑')
  if (value === null && field.nullable !== 'YES') throw new Error('该字段不允许 NULL')
  const predicates = [...keys, ...(keys.some((key) => key.name === field.name) ? [] : [field])].map((column) => {
    const index = result.columns.findIndex((item) => item.name === column.name)
    if (index < 0 || unsupported(column) || row[index] === undefined || (column.key === 'PRI' && row[index] === null)) throw new Error('结果缺少可用主键，请重新打开表')
    return 'CAST(' + name(column.name) + ' AS BINARY) <=> CAST(' + text(row[index]) + ' AS BINARY)'
  })
  return 'UPDATE ' + name(database) + '.' + name(table) + ' SET ' + name(field.name) + ' = ' + text(value) + ' WHERE ' + predicates.join(' AND ') + ' LIMIT 1;'
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
