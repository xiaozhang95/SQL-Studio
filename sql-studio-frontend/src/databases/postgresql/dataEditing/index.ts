import type { Column, QueryResult } from '../../../typings/database/index.ts'
import { identifier, literal, relation } from '../query/index.ts'

const unsupported = (column: Column) => /bytea|\[\]|geometry|geography|vector|range|record|^bit/i.test(column.type)
export const canInsertColumn = (column: Column) => !unsupported(column) && !/GENERATED|IDENTITY/i.test(column.extra)
export function updateCellSQL(_database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], columnIndex: number, value: string | null) {
  const field = columns.find((column) => column.name === result.columns[columnIndex]?.name)
  const keys = columns.filter((column) => column.key === 'PRI')
  if (!field || !keys.length || unsupported(field) || /GENERATED|IDENTITY/i.test(field.extra)) throw new Error('缺少主键或该字段不支持编辑')
  if (value === null && field.nullable !== 'YES') throw new Error('该字段不允许 NULL')
  const predicates = [...keys, ...(keys.some((key) => key.name === field.name) ? [] : [field])].map((column) => {
    const index = result.columns.findIndex((item) => item.name === column.name)
    if (index < 0 || row[index] === undefined || unsupported(column) || (column.key === 'PRI' && row[index] === null)) throw new Error('结果缺少可用主键，请重新打开表')
    return `${identifier(column.name)} IS NOT DISTINCT FROM ${literal(row[index])}`
  })
  return `UPDATE ${relation(table)} SET ${identifier(field.name)} = ${literal(value)} WHERE ${predicates.join(' AND ')};`
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
