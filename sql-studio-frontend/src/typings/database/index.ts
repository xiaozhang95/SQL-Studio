import type { DatabaseType } from '@/databases/typings'

export type Connection = {
  database?: string
  type?: DatabaseType
  tls?: boolean
  id: string
  name: string
  group?: string
  host: string
  port: number
  username: string
  hasPassword: boolean
  password?: string
}

/** 与后端 model 保持一致的数据库类型与 API 契约。 */
export type ConnectionInput = Omit<Connection, 'id' | 'hasPassword'> & {
  id?: string
}
export type DBTable = { name: string; type: string; comment: string; viewDependencies?: string[]; extension?: string }
export type Column = {
  name: string
  type: string
  nullable: string
  key: string
  default: string | null
  extra: string
  comment: string
  charset?: string
  collation?: string
}
export type DBIndex = {
  primary?: boolean
  name: string
  unique: boolean
  type: string
  columns: { name: string; position: number; prefixLength: number | null; order: string }[]
}
export type DBForeignKey = {
  name: string
  referencedSchema: string
  referencedTable: string
  onUpdate: string
  onDelete: string
  columns: { name: string; referencedName: string }[]
}
export type TableDetails = { columns: Column[]; indexes: DBIndex[]; foreignKeys?: DBForeignKey[]; foreignKeyError?: string }
export type QueryResult = {
  columns: { name: string; type: string }[]
  rows: unknown[][]
  rowCount: number
  affectedRows: number
  lastInsertId: string
  durationMs: number
  truncated: boolean
  isQuery: boolean
}
export type QueryRequest = { database: string; schema?: string; sql: string; allowWrite?: boolean; matchRows?: boolean; limit?: number }

export type MonitorSnapshot = {
  database: string
  sampledAt: string
  metrics: { key: string; value: string }[]
}
