import type { DBTable, QueryResult } from '../../../typings/database/index.ts'

export const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"'
/** Tree/API names are an unambiguous quoted pair, never split dots inside identifiers. */
export function tableIdentity(table: string): [string, string] {
  const match = /^"((?:""|[^"])*)"\."((?:""|[^"])*)"$/.exec(table)
  if (match) return [match[1].replaceAll('""', '"'), match[2].replaceAll('""', '"')]
  if (table.startsWith('"') || !table) throw new Error('表标识无效，请重新打开表')
  return ['public', table]
}
export const relation = (table: string) => tableIdentity(table).map(identifier).join('.')
export const tableDataSQL = (_database: string, table: string) => `SELECT * FROM ${relation(table)} LIMIT 1000;`
export const literal = (value: unknown): string => {
  if (value === null) return 'NULL'
  if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('该值暂不支持编辑')
  if (String(value).includes('\0')) throw new Error('PostgreSQL 文本不能包含空字符')
  return "E'" + String(value).replaceAll('\\', '\\\\').replaceAll("'", "''") + "'"
}
export const exportDDL = (database: string, table: string, ddl: string) =>
  `-- PostgreSQL database: ${database.replace(/[\r\n]/g, ' ')}\n-- 在目标数据库执行；结构参考不等同于完整备份\n-- ${table.replace(/[\r\n]/g, ' ')}\n${ddl.trim()}\n`

export function explorerTableIdentity(table: string) {
  const [schema, name] = tableIdentity(table)
  return { schema, name }
}
export const schemaListResult = (schemas: readonly string[]): Pick<QueryResult, 'columns' | 'rows'> => ({ columns: [{ name: 'Schema', type: '' }], rows: schemas.map((schema) => [schema]) })

export const tableLabel = (table: string) =>
  tableIdentity(table)
    .map((name) => (/^[a-z_][a-z0-9_$]*$/.test(name) ? name : identifier(name)))
    .join('.')
export function tableListResult(tables: readonly DBTable[], schema?: string): Pick<QueryResult, 'columns' | 'rows'> {
  return {
    columns: ['Schema', '表名', '类型', '注释'].map((name) => ({ name, type: '' })),
    rows: tables.flatMap((table) => {
      const identity = explorerTableIdentity(table.name)
      return schema && identity.schema !== schema ? [] : [[identity.schema, identity.name, table.type, table.comment]]
    })
  }
}
