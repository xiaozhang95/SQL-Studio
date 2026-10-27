import type { AIContext } from '@/typings/ai'
import type { Column, DBTable } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

export const aiContextLimits = { tables: 12, columns: 128, comment: 2000, column: 128 } as const

/** 仅在实际请求时整理上下文：SQL 扫描一次，表元数据线性选择，不对整库排序。 */
export function buildAIContext(scope: QueryScope, tables: readonly DBTable[], structures: Readonly<Record<string, { columns: readonly Column[] }>>, sql: string): AIContext {
  const referenced = new Set<string>()
  for (const match of sql.matchAll(/`((?:``|[^`])+)`|[\p{L}_$][\p{L}\p{N}_$]*/gu)) referenced.add((match[1]?.replaceAll('``', '`') || match[0]).toLowerCase())
  const selected: DBTable[] = [],
    seen = new Set<string>()
  const add = (table: DBTable) => {
    if (selected.length >= aiContextLimits.tables || seen.has(table.name)) return
    seen.add(table.name)
    selected.push(table)
  }
  const current = tables.find((table) => table.name === scope.table)
  if (current) add(current)
  for (const table of tables) {
    if (referenced.has(table.name.toLowerCase())) add(table)
    if (selected.length === aiContextLimits.tables) break
  }
  for (const table of tables) {
    add(table)
    if (selected.length === aiContextLimits.tables) break
  }
  return {
    connectionId: scope.connectionId,
    database: scope.database,
    table: scope.table,
    tables: selected.map((table) => ({
      name: table.name,
      comment: table.comment.slice(0, aiContextLimits.comment),
      columns: (structures[JSON.stringify([scope.database, table.name])]?.columns || [])
        .slice(0, aiContextLimits.columns)
        .map((column) => `${column.name} ${column.type}${column.key ? ` ${column.key}` : ''}${column.comment ? ` -- ${column.comment}` : ''}`.slice(0, aiContextLimits.column))
    }))
  }
}
