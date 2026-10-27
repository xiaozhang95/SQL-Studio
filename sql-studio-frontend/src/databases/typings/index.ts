import type { sql } from '@codemirror/lang-sql'

import type { Column, QueryResult } from '@/typings/database'

import type { DatabaseObjectAdapter } from './objectManagement'

/** 与服务端数据库类型保持一致；常量对象兼容 erasableSyntaxOnly。 */
export const DatabaseEngine = { MySQL: 'mysql' } as const
export type DatabaseType = (typeof DatabaseEngine)[keyof typeof DatabaseEngine]

export interface DatabaseProfile {
  readonly value: DatabaseType
  readonly label: string
  readonly description: string
  readonly className: string
  readonly port: number
  readonly icon: string
}

export interface SQLCompletionContext {
  database: string
  table: string
  schema: Record<string, Record<string, string[]>>
}

export interface DatabaseAdapter {
  isSQLColumn: (name: string) => boolean
  canInsertColumn: (column: Column) => boolean
  insertRowSQL: (database: string, table: string, columns: Column[], result: QueryResult, values: unknown[]) => string
  updateCellSQL: (database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], columnIndex: number, value: string | null) => string
  readonly profile: DatabaseProfile
  readonly objects: DatabaseObjectAdapter
  splitStatements: (script: string) => string[]
  useDatabase: (statement: string) => string | undefined
  cleanHistory: (script: string) => string
  tableDataSQL: (database: string, table: string) => string
  completion: (context: SQLCompletionContext) => ReturnType<typeof sql>
}
