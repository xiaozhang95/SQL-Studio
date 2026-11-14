import { useEffect, useState } from 'react'

import { DatabaseEngine } from '@/databases/typings'
import { getDatabaseMonitor, getDatabases } from '@/services/database'
import type { Connection, MonitorSnapshot } from '@/typings/database'

export const refreshIntervals = [0, 5, 15, 30, 60, 300] as const
type RefreshInterval = (typeof refreshIntervals)[number]

export function useDatabaseMonitor(connections: readonly Connection[], initialConnection: Connection | undefined, initialDatabase: string) {
  const [connectionId, setConnectionId] = useState(initialConnection?.id ?? connections[0]?.id ?? '')
  const [database, setDatabase] = useState(initialConnection ? initialDatabase : '')
  const [databaseList, setDatabaseList] = useState<{ connectionId: string; names: string[] }>()
  const [result, setResult] = useState<{ snapshot?: MonitorSnapshot; error?: string }>()
  const [refreshCount, setRefreshCount] = useState(0)
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(0)
  const [loading, setLoading] = useState(false)
  const connection = connections.find((item) => item.id === connectionId)
  const databaseScoped = connection?.type === DatabaseEngine.PostgreSQL || connection?.type === DatabaseEngine.GreptimeDB
  const scopeDatabase = databaseScoped ? database : ''
  const databases = databaseList?.connectionId === connectionId ? databaseList.names : []

  function selectConnection(id: string) {
    if (id === connectionId) return
    setResult(undefined)
    setConnectionId(id)
    setDatabase('')
  }

  useEffect(() => {
    if (!connectionId || !databaseScoped) return
    const controller = new AbortController()
    void getDatabases(connectionId, controller.signal)
      .then((names) => {
        if (!controller.signal.aborted) setDatabaseList({ connectionId, names })
      })
      .catch(() => {
        if (!controller.signal.aborted) setDatabaseList({ connectionId, names: [] })
      })
    return () => controller.abort()
  }, [connectionId, databaseScoped])

  useEffect(() => {
    if (!connection) return
    const controller = new AbortController()
    setLoading(true)
    const load = async () => {
      try {
        const snapshot = await getDatabaseMonitor(connection.id, scopeDatabase, controller.signal)
        if (!controller.signal.aborted) setResult({ snapshot })
      } catch (error) {
        if (!controller.signal.aborted) setResult((previous) => ({ ...previous, error: error instanceof Error ? error.message : '未读取到数据库统计' }))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [connection, scopeDatabase, refreshCount])

  useEffect(() => {
    if (!connection || !result || loading || !refreshInterval) return
    const timer = window.setTimeout(() => setRefreshCount((count) => count + 1), refreshInterval * 1000)
    return () => window.clearTimeout(timer)
  }, [connection, result, loading, refreshInterval])

  return {
    connection,
    databases,
    databaseScoped,
    database,
    loading,
    refreshInterval,
    setRefreshInterval,
    selectConnection,
    selectDatabase: (name: string) => {
      if (name === database) return
      setResult(undefined)
      setDatabase(name)
    },
    result: connection ? result : undefined,
    refresh: () => setRefreshCount((count) => count + 1)
  }
}
