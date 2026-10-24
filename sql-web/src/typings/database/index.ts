export type Connection = {
  type?: DatabaseType
  tls?: boolean
  id: string
  name: string
  host: string
  port: number
  username: string
  hasPassword: boolean
  password?: string
}

/** 与后端 model 保持一致的数据库类型与 API 契约。 */
export type DatabaseType = 'mysql'
export type ConnectionInput = Omit<Connection, 'id' | 'hasPassword'> & {
  id?: string
}
export type DBTable = { name: string; type: string; comment: string }
export type Column = {
  name: string
  type: string
  nullable: string
  key: string
  default: string | null
  extra: string
  comment: string
}
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
export type QueryRequest = { database: string; sql: string }
