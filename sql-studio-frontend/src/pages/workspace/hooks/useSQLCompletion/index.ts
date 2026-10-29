import { useMemo } from 'react'

import { getDatabaseAdapter } from '@/databases'
import type { Column, Connection } from '@/typings/database'
import type { QueryScope } from '@/typings/workspace'

import type { useDatabaseObjects } from '../useDatabaseObjects'

type Props = {
  scope: QueryScope
  connections: Connection[]
  objects: ReturnType<typeof useDatabaseObjects>
  columns: Column[]
}
export type SQLCompletionObjectKind = 'database' | 'schema' | 'table' | 'view' | 'object'

/** 元数据组织属于工作区，方言与扩展构造交给目标数据库模块。 */
export function useSQLCompletion({ scope, connections, objects, columns }: Props) {
  const adapter = getDatabaseAdapter(connections.find((connection) => connection.id === scope.connectionId)?.type)
  const snapshot = objects.snapshots[scope.connectionId]
  const connected = snapshot?.status === 'connected'
  const databases = snapshot?.databases
  const tables = snapshot?.tables
  const structures = snapshot?.structures
  const namespaces = snapshot?.schemas
  return useMemo(() => {
    const objectKinds = new Map<string, SQLCompletionObjectKind>()
    const addKind = (name: string, kind: SQLCompletionObjectKind) => {
      const existing = objectKinds.get(name)
      objectKinds.set(name, existing && existing !== kind ? 'object' : kind)
    }
    if (connected)
      for (const database of databases || []) {
        addKind(database, 'database')
        for (const name of namespaces?.[database] || []) addKind(name, 'schema')
        for (const table of tables?.[database] || []) {
          const identity = adapter.explorer?.tableIdentity(table.name)
          if (identity) addKind(identity.schema, 'schema')
          addKind(identity?.name ?? table.name, table.type.includes('VIEW') ? 'view' : 'table')
        }
      }
    return {
      objectKinds,
      extensions: [
        adapter.completion({
          database: scope.database,
          namespace: scope.schema,
          table: scope.table,
          schema: connected
            ? Object.fromEntries(
                (databases || []).map((database) => [
                  database,
                  Object.fromEntries(
                    (tables?.[database] || []).map((table) => {
                      const structure = structures?.[JSON.stringify([database, table.name])]
                      return [table.name, structure?.columns.map((column) => column.name) || (database === scope.database && table.name === scope.table ? columns.map((column) => column.name) : [])]
                    })
                  )
                ])
              )
            : {}
        })
      ]
    }
  }, [adapter, connected, databases, tables, structures, namespaces, scope.database, scope.schema, scope.table, columns])
}
