import type { sql } from '@codemirror/lang-sql'
import type { ComponentType } from 'react'

import type { Column, DBTable, QueryResult } from '@/typings/database'

import type { DatabaseDefinition, DatabaseObjectAdapter, ObjectAction, ObjectFormValues, ObjectTarget, TableDesignAdapter } from './objectManagement'

/** 与服务端数据库类型保持一致；常量对象兼容 erasableSyntaxOnly。 */
export const DatabaseEngine = { MySQL: 'mysql', MariaDB: 'mariadb', PostgreSQL: 'postgresql' } as const
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
  tableInSchema: (table: string, schema: string) => string
  schemaListResult: (schemas: readonly string[]) => Pick<QueryResult, 'columns' | 'rows'>
}

export interface DumpPlan {
  before: string
  after: string
  constraints?: string
  data: (result: QueryResult) => string
}

export interface DatabaseAdapter {
  readonly dumpFile: {
    metadataSQL?: (database: string) => string
    header: (database: string, schemas: string[], metadata?: QueryResult) => string
    footer: string
    prepare: (database: string, table: string, ddl: string, columns: Column[], metadata: QueryResult | undefined, withData: boolean) => DumpPlan
  }
  readonly explorer?: DatabaseExplorerAdapter
  isSQLColumn: (name: string) => boolean
  canInsertColumn: (column: Column) => boolean
  insertRowSQL: (database: string, table: string, columns: Column[], result: QueryResult, values: unknown[]) => string
  deleteRowSQL: (database: string, table: string, columns: Column[], result: QueryResult, row: unknown[]) => string
  updateCellSQL: (database: string, table: string, columns: Column[], result: QueryResult, row: unknown[], columnIndex: number, value: string | null) => string
  readonly profile: DatabaseProfile
  readonly objects: DatabaseObjectAdapter | undefined
  readonly tableDesign?: TableDesignAdapter
  readonly databaseEditor?: {
    metadataSQL: (database: string) => string
    definition: (result: QueryResult) => DatabaseDefinition
    sql: (database: string, values: ObjectFormValues, original: DatabaseDefinition) => string
    Form: ComponentType<{ creating: boolean; definition?: DatabaseDefinition }>
  }
  readonly dataDump?: {
    querySQL: (database: string, table: string) => string
    metadataSQL?: (database: string, table: string) => string
    dump: (database: string, table: string, ddl: string, result: QueryResult, columns: Column[], metadata?: QueryResult) => string
  }
  readonly simpleObjects?: {
    readonly actions: readonly ObjectAction[]
    sql: (action: ObjectAction, target: ObjectTarget, name: string) => string
    initialName: (action: ObjectAction, target: ObjectTarget) => string
    resultName: (action: ObjectAction, target: ObjectTarget, name: string) => string
  }
  splitStatements: (script: string) => string[]
  useDatabase: (statement: string) => string | undefined
  cleanHistory: (script: string) => string
  exportDDL: (database: string, table: string, ddl: string) => string
  tableLabel: (table: string) => string
  tableListResult: (tables: readonly DBTable[], schema?: string) => Pick<QueryResult, 'columns' | 'rows'>
  tableDataSQL: (database: string, table: string) => string
  completion: (context: SQLCompletionContext) => ReturnType<typeof sql>
}
