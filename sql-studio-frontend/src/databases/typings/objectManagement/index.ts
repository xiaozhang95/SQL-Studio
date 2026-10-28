import type { Column, QueryResult } from '@/typings/database'

export const ObjectAction = {
  CreateDatabase: 'createDatabase',
  EditDatabase: 'editDatabase',
  DropDatabase: 'dropDatabase',
  CreateTable: 'createTable',
  EditTable: 'editTable',
  DropTable: 'dropTable',
  TruncateTable: 'truncateTable',
  RenameTable: 'renameTable'
} as const
export type ObjectAction = (typeof ObjectAction)[keyof typeof ObjectAction]
export type ObjectTarget = { connectionId: string; database: string; table: string; schema?: string; view?: boolean }
export type FieldDefinition = {
  originalName?: string
  name: string
  type: string
  nullable: boolean
  primary: boolean
  autoIncrement: boolean
  defaultMode: 'none' | 'null' | 'literal' | 'expression'
  defaultValue: string
  comment: string
  charset?: string
  collation?: string
  extra: string
  locked?: boolean
}
export type ObjectFormValues = { name: string; charset: string; collation: string; fields: FieldDefinition[]; confirmation: string }
export type CollationOption = { charset: string; name: string; default: boolean }
export type DatabaseDefinition = { name: string; charset: string; collation: string }
export type ObjectChange = { action: ObjectAction; target: ObjectTarget; name: string }
export interface TableDesignAdapter {
  readonly fieldTypes: readonly string[]
  initialFields: () => FieldDefinition[]
  defaultField: () => FieldDefinition
  fields: (columns: Column[], ddl?: string) => FieldDefinition[]
  sql: (action: ObjectAction, target: ObjectTarget, values: ObjectFormValues, original: FieldDefinition[]) => string
  identity: (target: ObjectTarget, name: string) => string
  sameDefinition: (current: string, original: string) => boolean
}
export interface DatabaseObjectAdapter {
  defaultCollation: (options: readonly CollationOption[]) => CollationOption | undefined
  initialFields: () => FieldDefinition[]
  dumpWithData: (database: string, table: string, ddl: string, result: QueryResult, columns: Column[]) => string
  readonly collationsSQL: string
  readonly sqlModeSQL: string
  sameDefinition: (current: string, original: string) => boolean
  readonly fieldTypes: readonly string[]
  databaseInfoSQL: (database: string) => string
  databaseDefinition: (result: QueryResult) => DatabaseDefinition
  collations: (result: QueryResult) => CollationOption[]
  fields: (columns: Column[], ddl?: string) => FieldDefinition[]
  defaultField: () => FieldDefinition
  sql: (action: ObjectAction, target: ObjectTarget, values: ObjectFormValues, original: FieldDefinition[], sqlMode: string) => string
  dumpQuerySQL: (database: string, table: string) => string
  dumpData: (database: string, table: string, result: QueryResult, columns: Column[]) => string
  dump: (database: string, table: string, ddl: string) => string
}
