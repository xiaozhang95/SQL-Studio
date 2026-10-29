import type { Column, Connection, ConnectionInput, DBIndex, DBTable, QueryRequest, QueryResult } from '@/typings/database'
import { post, request } from '@/utils/request'

const connectionPath = (id: string) => `/connections/${encodeURIComponent(id)}`
const tableQuery = (database: string, table: string) => new URLSearchParams({ database, table })

export const getConnections = (signal?: AbortSignal) => request<Connection[]>('/connections', { signal })
export const getConnectionGroups = (signal?: AbortSignal) => request<string[]>('/connection-groups', { signal })
export const createConnectionGroup = (name: string) => request<string[]>('/connection-groups', post({ name }))
export const renameConnectionGroup = (name: string, newName: string) => request<{ groups: string[]; connections: Connection[] }>('/connection-groups/rename', post({ name, newName }))
export const deleteConnectionGroup = (name: string) => request<{ groups: string[]; connections: Connection[] }>('/connection-groups', { ...post({ name }), method: 'DELETE' })
export const moveConnectionGroup = (id: string, group: string) => request<Connection>(`${connectionPath(id)}/group`, { ...post({ group }), method: 'PATCH' })
export const saveConnection = (connection: ConnectionInput) => request<Connection>('/connections', post(connection))
export const deleteConnection = (id: string) => request<{ ok: boolean }>(connectionPath(id), { method: 'DELETE' })
export const testConnection = (connection: ConnectionInput) => request<{ version: string }>('/connections/test', post(connection))
export const setConnectionSession = (id: string, open: boolean, database?: string, signal?: AbortSignal) =>
  request<{ open: boolean }>(`${connectionPath(id)}/session`, { ...post({ open, ...(database === undefined ? {} : { database }) }), signal })
export const getDatabases = (id: string, signal?: AbortSignal) => request<string[]>(`${connectionPath(id)}/databases`, { signal })
export const getSchemas = (id: string, database: string, signal?: AbortSignal) => request<string[]>(`${connectionPath(id)}/schemas?${new URLSearchParams({ database })}`, { signal })
export const getTables = (id: string, database: string, signal?: AbortSignal) => request<DBTable[]>(`${connectionPath(id)}/tables?${new URLSearchParams({ database })}`, { signal })
export const getColumns = (id: string, database: string, table: string, signal?: AbortSignal) => request<Column[]>(`${connectionPath(id)}/columns?${tableQuery(database, table)}`, { signal })
export const getDDL = (id: string, database: string, table: string, signal?: AbortSignal) => request<{ ddl: string }>(`${connectionPath(id)}/ddl?${tableQuery(database, table)}`, { signal })
export const getIndexes = (id: string, database: string, table: string, signal?: AbortSignal) => request<DBIndex[]>(`${connectionPath(id)}/indexes?${tableQuery(database, table)}`, { signal })
export const executeQuery = (id: string, input: QueryRequest, signal?: AbortSignal) => request<QueryResult>(`${connectionPath(id)}/query`, { ...post(input), signal })

/** 仅对象管理和单元格显式保存使用；普通查询保持默认只读。 */
export const executeObjectSQL = (id: string, database: string, sql: string, signal?: AbortSignal) => executeQuery(id, { database, sql, allowWrite: true }, signal)
