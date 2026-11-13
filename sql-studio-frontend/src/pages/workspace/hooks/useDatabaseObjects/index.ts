import { useCallback, useEffect, useRef, useState } from 'react'

import { getColumns, getDatabases, getDDL, getIndexes, getSchemas, getTables, setConnectionSession } from '@/services/database'
import type { Column, DBTable, TableDetails } from '@/typings/database'

import { DatabaseLifecycle } from '../../utils/databaseLifecycle'

type TableStructure = { columns: Column[]; ddl: string }

type Snapshot = {
  schemas?: Record<string, string[]>
  status: 'loading' | 'connected' | 'error'
  databases: string[]
  tables: Record<string, DBTable[]>
  loadingTables: string[]
  error: string
  tableErrors: Record<string, string>
  structures: Record<string, TableStructure>
  details: Record<string, TableDetails>
  detailErrors: Record<string, string>
}
type Session = {
  controller: AbortController
  lifecycle: DatabaseLifecycle
  databases?: string[]
  opening?: Promise<string[]>
  refreshing?: Promise<string[]>
  tables: Record<string, DBTable[]>
  schemas: Record<string, string[]>
  pending: Map<string, Promise<DBTable[]>>
  structures: Record<string, TableStructure>
  pendingStructures: Map<string, Promise<TableStructure>>
  details: Record<string, TableDetails>
  pendingDetails: Map<string, Promise<TableDetails>>
}

/** 各连接分别维护结构缓存；关闭或刷新时取消旧代请求，避免迟到响应重新点亮节点。 */
export function useDatabaseObjects(connectionId: string, database: string, onDatabasesLoaded: (id: string, databases: string[]) => void, schemaConnections: readonly string[]) {
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({})
  const sessions = useRef(new Map<string, Session>())
  const current = snapshots[connectionId]
  const [closedDatabases, setClosedDatabases] = useState<Record<string, string[]>>({})

  useEffect(() => {
    const active = sessions.current
    return () => {
      active.forEach((session) => session.controller.abort())
      active.clear()
    }
  }, [])

  const retainConnections = useCallback((ids: ReadonlySet<string>) => {
    for (const [id, session] of sessions.current) {
      if (ids.has(id)) continue
      session.controller.abort()
      sessions.current.delete(id)
    }
    setSnapshots((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => ids.has(id))))
    setClosedDatabases({})
  }, [])

  const closeConnection = useCallback(async (id: string) => {
    sessions.current.get(id)?.controller.abort()
    await setConnectionSession(id, false)
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
      if (existing?.databases && !existing.controller.signal.aborted) return Promise.resolve(existing.databases)
      if (existing?.opening && !existing.controller.signal.aborted) return existing.opening
      existing?.controller.abort()
      const controller = new AbortController()
      const session: Session = {
        controller,
        lifecycle: new DatabaseLifecycle(controller.signal),
        tables: {},
        schemas: {},
        pending: new Map(),
        structures: {},
        pendingStructures: new Map(),
        details: {},
        pendingDetails: new Map()
      }
      sessions.current.set(id, session)
      const valid = () => sessions.current.get(id) === session && !session.controller.signal.aborted
      setSnapshots((previous) => ({
        ...previous,
        [id]: { status: 'loading', databases: [], tables: {}, loadingTables: [], error: '', tableErrors: {}, structures: {}, details: {}, detailErrors: {} }
      }))
      const task = setConnectionSession(id, true, undefined, session.controller.signal)
        .then(() => getDatabases(id, session.controller.signal))
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
      return closeConnection(id).then(() => openConnection(id))
    },
    [closeConnection, openConnection]
  )

  const invalidateDatabase = useCallback((id: string, name: string, keepVisibleTables = false) => {
    const session = sessions.current.get(id)
    if (!session) return
    session.lifecycle.close(name)
    const without = <T>(values: Record<string, T>) => Object.fromEntries(Object.entries(values).filter(([key]) => JSON.parse(key)[0] !== name))
    delete session.tables[name]
    delete session.schemas[name]
    session.pending.delete(name)
    session.structures = without(session.structures)
    session.details = without(session.details)
    for (const pending of [session.pendingStructures, session.pendingDetails]) for (const key of pending.keys()) if (JSON.parse(key)[0] === name) pending.delete(key)
    setSnapshots((previous) => {
      const state = previous[id]
      if (!state || sessions.current.get(id) !== session) return previous
      const tables = { ...state.tables },
        schemas = { ...state.schemas },
        tableErrors = { ...state.tableErrors }
      if (!keepVisibleTables) {
        delete tables[name]
        delete schemas[name]
      }
      delete tableErrors[name]
      return {
        ...previous,
        [id]: {
          ...state,
          tables,
          schemas,
          tableErrors,
          loadingTables: state.loadingTables.filter((item) => item !== name),
          structures: without(state.structures),
          details: without(state.details),
          detailErrors: without(state.detailErrors)
        }
      }
    })
  }, [])

  const loadTables = useCallback(
    (name: string, id = connectionId): Promise<DBTable[]> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.resolve([])
      const scope = session.lifecycle.scope(name)
      if (session.tables[name]) return Promise.resolve(session.tables[name])
      const pending = session.pending.get(name)
      if (pending) return pending
      const valid = () => sessions.current.get(id) === session && scope.valid()
      setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], loadingTables: [...previous[id].loadingTables, name], tableErrors: { ...previous[id].tableErrors, [name]: '' } } }))
      const task = setConnectionSession(id, true, name, scope.signal)
        .then(() => {
          if (!valid()) throw new Error('数据库已关闭')
          setClosedDatabases((previous) => ({ ...previous, [id]: (previous[id] || []).filter((item) => item !== name) }))
          return Promise.all([getTables(id, name, scope.signal), schemaConnections.includes(id) ? getSchemas(id, name, scope.signal) : Promise.resolve([])])
        })
        .then(([tables, schemas]) => {
          if (!valid()) throw new Error('数据库已关闭')
          if (valid()) {
            session.tables[name] = tables
            session.schemas[name] = schemas
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], tables: { ...previous[id].tables, [name]: tables }, schemas: { ...previous[id].schemas, [name]: schemas } } }))
          }
          return tables
        })
        .catch((error) => {
          if (valid())
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], tableErrors: { ...previous[id].tableErrors, [name]: error instanceof Error ? error.message : '表列表加载失败' } } }))
          throw error
        })
        .finally(() => {
          if (session.pending.get(name) === task) session.pending.delete(name)
          if (valid()) setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], loadingTables: previous[id].loadingTables.filter((item) => item !== name) } }))
        })
      session.pending.set(name, task)
      return task
    },
    [connectionId, schemaConnections]
  )

  const loadSchemas = useCallback(
    async (name: string, id = connectionId): Promise<string[]> => {
      const session = sessions.current.get(id)
      if (!session) throw new Error('请先打开连接')
      await loadTables(name, id)
      if (sessions.current.get(id) !== session || session.controller.signal.aborted || !session.schemas[name]) throw new Error('数据库已关闭或结构已失效')
      return session.schemas[name]
    },
    [connectionId, loadTables]
  )

  const loadStructure = useCallback(
    (database: string, table: string, id = connectionId): Promise<TableStructure> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.reject(new Error('请先打开连接'))
      const scope = session.lifecycle.scope(database)
      const key = JSON.stringify([database, table])
      if (session.structures[key]) return Promise.resolve(session.structures[key])
      const pending = session.pendingStructures.get(key)
      if (pending) return pending
      const task = Promise.all([session.details[key] ? Promise.resolve(session.details[key].columns) : getColumns(id, database, table, scope.signal), getDDL(id, database, table, scope.signal)])
        .then(([columns, definition]) => {
          const structure = { columns, ddl: definition.ddl }
          if (sessions.current.get(id) !== session || !scope.valid()) throw new Error('连接已关闭')
          session.structures[key] = structure
          setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], structures: { ...previous[id].structures, [key]: structure } } }))
          return structure
        })
        .finally(() => {
          if (session.pendingStructures.get(key) === task) session.pendingStructures.delete(key)
        })
      session.pendingStructures.set(key, task)
      return task
    },
    [connectionId]
  )

  const loadTableDetails = useCallback(
    (database: string, table: string, id = connectionId): Promise<TableDetails> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.reject(new Error('请先打开连接'))
      const scope = session.lifecycle.scope(database)
      const key = JSON.stringify([database, table])
      if (session.details[key]) return Promise.resolve(session.details[key])
      const pending = session.pendingDetails.get(key)
      if (pending) return pending
      const valid = () => sessions.current.get(id) === session && scope.valid()
      setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], detailErrors: { ...previous[id].detailErrors, [key]: '' } } }))
      // 树展开只读元数据，不执行表数据 SQL，也不让索引权限错误影响原有 DDL/补全流程。
      const task = Promise.all([
        session.structures[key] ? Promise.resolve(session.structures[key].columns) : getColumns(id, database, table, scope.signal),
        getIndexes(id, database, table, scope.signal)
      ])
        .then(([columns, indexes]) => {
          if (!valid()) throw new Error('连接已关闭')
          const details = { columns, indexes }
          session.details[key] = details
          setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], details: { ...previous[id].details, [key]: details } } }))
          return details
        })
        .catch((error) => {
          if (valid())
            setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], detailErrors: { ...previous[id].detailErrors, [key]: error instanceof Error ? error.message : '表结构加载失败' } } }))
          throw error
        })
        .finally(() => {
          if (session.pendingDetails.get(key) === task) session.pendingDetails.delete(key)
        })
      session.pendingDetails.set(key, task)
      return task
    },
    [connectionId]
  )

  const refreshDatabases = useCallback(
    (id: string): Promise<string[]> => {
      const session = sessions.current.get(id)
      if (!session?.databases || session.controller.signal.aborted) return Promise.resolve([])
      if (session.refreshing) return session.refreshing
      const task = getDatabases(id, session.controller.signal)
        .then((databases) => {
          if (sessions.current.get(id) !== session || session.controller.signal.aborted) throw new Error('连接已关闭')
          const names = new Set(databases)
          for (const name of session.databases || []) if (!names.has(name)) invalidateDatabase(id, name)
          session.databases = databases
          onDatabasesLoaded(id, databases)
          setSnapshots((previous) => ({ ...previous, [id]: { ...previous[id], databases } }))
          return databases
        })
        .finally(() => {
          if (session.refreshing === task) session.refreshing = undefined
        })
      session.refreshing = task
      return task
    },
    [invalidateDatabase, onDatabasesLoaded]
  )

  const refreshTables = useCallback(
    (name: string, id = connectionId, force = false): Promise<DBTable[]> => {
      const session = sessions.current.get(id)
      const loaded = Boolean(session?.tables[name]) || Boolean(session?.pending.has(name))
      invalidateDatabase(id, name, true)
      // 新对象只更新已经打开的列表；从未打开的库保持安静。
      return loaded || force ? loadTables(name, id) : Promise.resolve([])
    },
    [connectionId, invalidateDatabase, loadTables]
  )

  const closeDatabase = useCallback(
    async (id: string, name: string) => {
      const session = sessions.current.get(id)
      if (!session) return
      session.lifecycle.close(name)
      await setConnectionSession(id, false, name)
      if (sessions.current.get(id) !== session) return
      invalidateDatabase(id, name)
      setClosedDatabases((previous) => ({ ...previous, [id]: [...new Set([...(previous[id] || []), name])] }))
    },
    [invalidateDatabase]
  )

  return {
    snapshots,
    retainConnections,
    closedDatabases,
    closeDatabase,
    openConnection,
    closeConnection,
    refreshConnection,
    refreshDatabases,
    refreshTables,
    loadTables,
    loadSchemas,
    loadStructure,
    loadTableDetails,
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
