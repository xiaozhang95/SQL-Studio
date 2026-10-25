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

/** 元数据组织属于工作区，方言与扩展构造交给目标数据库模块。 */
export function useSQLCompletion({ scope, connections, objects, columns }: Props) {
  const adapter = getDatabaseAdapter(connections.find((connection) => connection.id === scope.connectionId)?.type)
  const snapshot = objects.snapshots[scope.connectionId]
  return useMemo(
    () => [
      adapter.completion({
        database: scope.database,
        table: scope.table,
        schema: objects.connected
          ? Object.fromEntries(
              objects.databases.map((database) => [
                database,
                Object.fromEntries(
                  (objects.tables[database] || []).map((table) => {
                    const structure = snapshot?.structures[JSON.stringify([database, table.name])]
                    return [table.name, structure?.columns.map((column) => column.name) || (database === scope.database && table.name === scope.table ? columns.map((column) => column.name) : [])]
                  })
                )
              ])
            )
          : {}
      })
    ],
    [adapter, objects.connected, objects.databases, objects.tables, snapshot, scope.database, scope.table, columns]
  )
}
