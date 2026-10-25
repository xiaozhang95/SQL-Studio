import { useCallback, useEffect, useRef, useState } from 'react'

import { getColumns, getDatabases, getDDL, getTables } from '@/services/database'
import type { Column, DBTable } from '@/typings/database'

type TableStructure = { columns: Column[]; ddl: string }

type Snapshot = {
  status: 'loading' | 'connected' | 'error'
  databases: string[]
  tables: Record<string, DBTable[]>
  loadingTables: string[]
  error: string
  tableErrors: Record<string, string>
  structures: Record<string, TableStructure>
}
type Session = {
  controller: AbortController
  databases?: string[]
  opening?: Promise<string[]>
  tables: Record<string, DBTable[]>
  pending: Map<string, Promise<DBTable[]>>
  structures: Record<string, TableStructure>
  pendingStructures: Map<string, Promise<TableStructure>>
}

/** 各连接分别维护结构缓存；关闭或刷新时取消旧代请求，避免迟到响应重新点亮节点。 */
export function useDatabaseObjects(connectionId: string, database: string, onDatabasesLoaded: (id: string, databases: string[]) => void) {
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({})
  const sessions = useRef(new Map<string, Session>())
  const current = snapshots[connectionId]

  useEffect(() => {
    const active = sessions.current
    return () => {
      active.forEach((session) => session.controller.abort())
      active.clear()
    }
  }, [])

  const closeConnection = useCallback((id: string) => {
    sessions.current.get(id)?.controller.abort()
    sessions.current.delete(id)
    setSnapshots((previous) => {
      const next = { ...previous }
      delete next[id]
      return next
    })
  }, [])

  const openConnection = useCallback(
    (id: string): Promise<string[]> => {
      const existing = sessions.current.get(id)
      if (existing?.databases) return Promise.resolve(existing.databases)
      if (existing?.opening) return existing.opening
      existing?.controller.abort()
      const session: Session = { controller: new AbortController(), tables: {}, pending: new Map(), structures: {}, pendingStructures: new Map() }
      sessions.current.set(id, session)
      const valid = () => sessions.current.get(id) === session && !session.controller.signal.aborted
      setSnapshots((previous) => ({ ...previous, [id]: { status: 'loading', databases: [], tables: {}, loadingTables: [], error: '', tableErrors: {}, structures: {} } }))
      const task = getDatabases(id, session.controller.signal)
        .then((databases) => {
          if (valid()) {
            session.databases = databases
            onDatabasesLoaded(id, databases)
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], status: 'connected', databases } }))
          }
          return databases
        })
        .catch((error) => {
          if (valid()) setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], status: 'error', error: error instanceof Error ? error.message : '连接失败' } }))
          throw error
        })
        .finally(() => {
          session.opening = undefined
        })
      session.opening = task
      return task
    },
    [onDatabasesLoaded]
  )

  const refreshConnection = useCallback(
    (id: string) => {
      closeConnection(id)
      return openConnection(id)
    },
    [closeConnection, openConnection]
  )

  const loadTables = useCallback(
    (name: string, id = connectionId): Promise<DBTable[]> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.resolve([])
      if (session.tables[name]) return Promise.resolve(session.tables[name])
      const pending = session.pending.get(name)
      if (pending) return pending
      const valid = () => sessions.current.get(id) === session && !session.controller.signal.aborted
      setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], loadingTables: [...previous[id].loadingTables, name], tableErrors: { ...previous[id].tableErrors, [name]: '' } } }))
      const task = getTables(id, name, session.controller.signal)
        .then((tables) => {
          if (valid()) {
            session.tables[name] = tables
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], tables: { ...previous[id].tables, [name]: tables } } }))
          }
          return tables
        })
        .catch((error) => {
          if (valid())
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], tableErrors: { ...previous[id].tableErrors, [name]: error instanceof Error ? error.message : '表列表加载失败' } } }))
          throw error
        })
        .finally(() => {
          session.pending.delete(name)
          if (valid()) setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], loadingTables: previous[id].loadingTables.filter((item) => item !== name) } }))
        })
      session.pending.set(name, task)
      return task
    },
    [connectionId]
  )

  const loadStructure = useCallback(
    (database: string, table: string, id = connectionId): Promise<TableStructure> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.reject(new Error('请先打开连接'))
      const key = JSON.stringify([database, table])
      if (session.structures[key]) return Promise.resolve(session.structures[key])
      const pending = session.pendingStructures.get(key)
      if (pending) return pending
      const task = Promise.all([getColumns(id, database, table, session.controller.signal), getDDL(id, database, table, session.controller.signal)])
        .then(([columns, definition]) => {
          const structure = { columns, ddl: definition.ddl }
          if (sessions.current.get(id) !== session || session.controller.signal.aborted) throw new Error('连接已关闭')
          session.structures[key] = structure
          setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], structures: { ...previous[id].structures, [key]: structure } } }))
          return structure
        })
        .finally(() => session.pendingStructures.delete(key))
      session.pendingStructures.set(key, task)
      return task
    },
    [connectionId]
  )

  return {
    snapshots,
    openConnection,
    closeConnection,
    refreshConnection,
    loadTables,
    loadStructure,
    connected: current?.status === 'connected',
    databases: current?.databases || [],
    tables: current?.tables || {},
    loading: current?.status === 'loading',
    error: current?.error || '',
    currentTables: current?.tables[database] || [],
    tablesLoading: Boolean(current?.loadingTables.includes(database)),
    tableError: current?.tableErrors[database] || ''
  }
}
