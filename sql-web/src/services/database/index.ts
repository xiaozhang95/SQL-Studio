import type { Column, Connection, ConnectionInput, DBTable, QueryRequest, QueryResult } from '@/typings/database'
import { post, request } from '@/utils/request'

const connectionPath = (id: string) => `/connections/${encodeURIComponent(id)}`
const tableQuery = (database: string, table: string) => new URLSearchParams({ database, table })

export const getConnections = (signal?: AbortSignal) => request<Connection[]>('/connections', { signal })
export const saveConnection = (connection: ConnectionInput) => request<Connection>('/connections', post(connection))
export const deleteConnection = (id: string) => request<{ ok: boolean }>(connectionPath(id), { method: 'DELETE' })
export const testConnection = (connection: ConnectionInput) => request<{ version: string }>('/connections/test', post(connection))
export const getDatabases = (id: string, signal?: AbortSignal) => request<string[]>(`${connectionPath(id)}/databases`, { signal })
export const getTables = (id: string, database: string, signal?: AbortSignal) => request<DBTable[]>(`${connectionPath(id)}/tables?${new URLSearchParams({ database })}`, { signal })
export const getColumns = (id: string, database: string, table: string, signal?: AbortSignal) => request<Column[]>(`${connectionPath(id)}/columns?${tableQuery(database, table)}`, { signal })
export const getDDL = (id: string, database: string, table: string, signal?: AbortSignal) => request<{ ddl: string }>(`${connectionPath(id)}/ddl?${tableQuery(database, table)}`, { signal })
export const executeQuery = (id: string, input: QueryRequest, signal?: AbortSignal) => request<QueryResult>(`${connectionPath(id)}/query`, { ...post(input), signal })
