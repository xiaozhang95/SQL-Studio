import type { Column, QueryResult } from '../../typings/database/index.ts'

export function originalRowFields(columns: readonly Column[], result: QueryResult, row: readonly unknown[]) {
  const incomplete = '缺少完整的原始行数据，请刷新表后重试'
  if (!columns.length || columns.length !== result.columns.length || row.length !== result.columns.length || result.truncatedBy === 'oversized-row') {
    throw new Error(incomplete)
  }
  const indexes = new Map(result.columns.map(({ name }, index) => [name, index]))
  return columns.map((column) => {
    const index = indexes.get(column.name)
    if (index === undefined) throw new Error(incomplete)
    const value = row[index]
    if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' && !(typeof value === 'number' && Number.isFinite(value))) throw new Error(incomplete)
    return { column, type: result.columns[index].type, value }
  })
}
