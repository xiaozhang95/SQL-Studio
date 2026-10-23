import { useCallback, useEffect, useRef, useState } from 'react'

import { getDatabases, getTables } from '@/services/database'
import type { DBTable } from '@/typings/database'

type Snapshot = { scope: string; databases: string[]; tables: Record<string, DBTable[]>; error: string; tableErrors: Record<string, string> }
type RequestScope = { scope: string; controller: AbortController; cache: Record<string, DBTable[]>; pending: Map<string, Promise<DBTable[]>> }

/** 按连接与刷新代次缓存元数据，并取消已过期的请求。 */
export function useDatabaseObjects(connectionId: string, database: string, refresh: number) {
  const scope = `${connectionId}:${refresh}`
  const [snapshot, setSnapshot] = useState<Snapshot>({ scope: '', databases: [], tables: {}, error: '', tableErrors: {} })
  const requests = useRef<RequestScope | null>(null)
  const current = snapshot.scope === scope ? snapshot : undefined

  useEffect(() => {
    const controller = new AbortController()
    requests.current = { scope, controller, cache: {}, pending: new Map() }
    if (connectionId)
      getDatabases(connectionId, controller.signal)
        .then((databases) => {
          if (!controller.signal.aborted) setSnapshot({ scope, databases, tables: {}, error: '', tableErrors: {} })
        })
        .catch((error) => {
          if (!controller.signal.aborted) setSnapshot({ scope, databases: [], tables: {}, error: error.message, tableErrors: {} })
        })
    return () => controller.abort()
  }, [connectionId, scope])

  const loadTables = useCallback(
    (name: string): Promise<DBTable[]> => {
      const active = requests.current
      if (!active || active.scope !== scope || active.controller.signal.aborted) return Promise.resolve([])
      if (active.cache[name]) return Promise.resolve(active.cache[name])
      const pending = active.pending.get(name)
      if (pending) return pending
      const task = getTables(connectionId, name, active.controller.signal)
        .then((tables) => {
          if (!active.controller.signal.aborted) {
            active.cache[name] = tables
            setSnapshot((previous) => (previous.scope === scope ? { ...previous, tables: { ...previous.tables, [name]: tables } } : previous))
          }
          return tables
        })
        .catch((error) => {
          if (!active.controller.signal.aborted) setSnapshot((previous) => (previous.scope === scope ? { ...previous, tableErrors: { ...previous.tableErrors, [name]: error.message } } : previous))
          throw error
        })
        .finally(() => active.pending.delete(name))
      active.pending.set(name, task)
      return task
    },
    [connectionId, scope]
  )

  const ready = Boolean(current && !current.error)
  useEffect(() => {
    if (ready && database) void loadTables(database).catch(() => {})
  }, [ready, database, loadTables])

  return {
    databases: current?.databases || [],
    tables: current?.tables || {},
    loadTables,
    loading: Boolean(connectionId && !current),
    error: current?.error || '',
    currentTables: current?.tables[database] || [],
    tablesLoading: Boolean(database && ready && !current?.tables[database] && !current?.tableErrors[database]),
    tableError: current?.tableErrors[database] || ''
  }
}
