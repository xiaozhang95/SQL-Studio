import type { DatabaseAdapter } from '@/databases/typings'
import type { DBTable, QueryResult } from '@/typings/database'
import type { WorkspaceTab } from '@/typings/workspace'

/** Display migration only: raw table identities and cached execution targets are never rewritten. */
export function presentTableList(result: QueryResult | undefined, adapter: DatabaseAdapter, schema?: string): QueryResult | undefined {
  if (!result || !adapter.explorer || result.columns.some((column) => column.name === 'Schema')) return result
  const name = result.columns.findIndex((column) => column.name === '表名')
  const kind = result.columns.findIndex((column) => column.name === '类型')
  const comment = result.columns.findIndex((column) => column.name === '注释')
  if (name < 0 || kind < 0) return result
  const tables: DBTable[] = []
  for (const row of result.rows) {
    if (typeof row[name] !== 'string' || typeof row[kind] !== 'string') return result
    tables.push({ name: row[name], type: row[kind], comment: typeof row[comment] === 'string' ? row[comment] : '' })
  }
  try {
    const listing = adapter.tableListResult(tables, schema)
    return { ...result, ...listing, rowCount: listing.rows.length }
  } catch {
    return result
  }
}
export function presentObjectPage(page: WorkspaceTab, adapter: DatabaseAdapter): WorkspaceTab {
  if (!adapter.explorer) return page
  try {
    const schema = page.schema ?? (page.table ? adapter.explorer.tableIdentity(page.table).schema : undefined)
    const suffix = page.kind === 'data' ? '数据' : page.kind === 'ddl' ? 'DDL' : page.kind === 'structure' ? '结构' : undefined
    const title = suffix ? `${page.table ? adapter.tableLabel(page.table) : page.database + (schema ? ' / ' + schema : '')} · ${suffix}` : page.title
    return title === page.title && schema === page.schema ? page : { ...page, title, schema }
  } catch {
    return page
  }
}
