import type { sql } from '@codemirror/lang-sql'

import type { Column, DBTable, QueryResult } from '@/typings/database'

import type { DatabaseObjectAdapter } from './objectManagement'

/** 与服务端数据库类型保持一致；常量对象兼容 erasableSyntaxOnly。 */
export const DatabaseEngine = { MySQL: 'mysql', PostgreSQL: 'postgresql' } as const
export type DatabaseType = (typeof DatabaseEngine)[keyof typeof DatabaseEngine]

export interface DatabaseProfile {
  readonly value: DatabaseType
  readonly label: string
  readonly description: string
  readonly className: string
  readonly port: number
  readonly database?: string
  readonly iconPresentation?: 'brand'
  /** 品牌图形的固定衬底，确保主题及选中背景下对比度稳定。 */
  readonly iconBackground?: string
  readonly icon: string
}

export interface SQLCompletionContext {
  database: string
  namespace?: string
  table: string
  schema: Record<string, Record<string, string[]>>
}

export interface DatabaseExplorerAdapter {
  referencedTables?: (sql: string, tables: readonly DBTable[], schema?: string) => ReadonlySet<string>
  tableIdentity: (table: string) => { schema: string; name: string }
}

export interface DatabaseAdapter {
  readonly explorer?: DatabaseExplorerAdapter
  isSQLColumn: (name: string) => boolean
  canInsertColumn: (column: Column) => boolean
  insertRowSQL: (database: string, table: string, columns: Column[], result: QueryResult, values: unknown[]) => string
  updateCellSQL: (database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], columnIndex: number, value: string | null) => string
  readonly profile: DatabaseProfile
  readonly objects: DatabaseObjectAdapter | undefined
  splitStatements: (script: string) => string[]
  useDatabase: (statement: string) => string | undefined
  cleanHistory: (script: string) => string
  exportDDL: (database: string, table: string, ddl: string) => string
  tableLabel: (table: string) => string
  tableListResult: (tables: readonly DBTable[], schema?: string) => Pick<QueryResult, 'columns' | 'rows'>
  tableDataSQL: (database: string, table: string) => string
  completion: (context: SQLCompletionContext) => ReturnType<typeof sql>
}
