import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { DatabaseEngine } from '@/databases/typings'
import { getDatabaseMonitor, getDatabases } from '@/services/database'
import type { Connection, MonitorSnapshot } from '@/typings/database'
import { isMonitorReset } from '@/utils/monitorMetrics'

export const refreshIntervals = [0, 5, 15, 30, 60, 300] as const
type RefreshInterval = (typeof refreshIntervals)[number]
const maximumHistory = 120
const initialSampleDelay = 1000
type MonitorResult = { scope: string; snapshot?: MonitorSnapshot; history: readonly MonitorSnapshot[]; error?: string }

export function useDatabaseMonitor(connections: readonly Connection[], initialConnection: Connection | undefined, initialDatabase: string) {
  const [selection, setSelection] = useState({ connectionId: initialConnection?.id ?? connections[0]?.id ?? '', database: initialConnection ? initialDatabase : '' })
  const [databaseList, setDatabaseList] = useState<{ connectionId: string; names: string[] }>()
  const [result, setResult] = useState<MonitorResult>()
  const latestResult = useRef<MonitorResult | undefined>(undefined)
  const [refreshCount, setRefreshCount] = useState(0)
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(5)
  const [loading, setLoading] = useState(false)
  const sampleRequest = useRef<AbortController | null>(null)
  const interval = useRef<number>(refreshInterval)
  const scheduleNext = useRef<(() => void) | null>(null)
  const connection = connections.find((item) => item.id === selection.connectionId) ?? connections.find((item) => item.id === initialConnection?.id) ?? connections[0]
  const connectionId = connection?.id ?? ''
  const database = selection.connectionId === connectionId ? selection.database : connectionId === initialConnection?.id ? initialDatabase : ''
  const databaseScoped = connection?.type === DatabaseEngine.PostgreSQL || connection?.type === DatabaseEngine.GreptimeDB
  const scopeDatabase = databaseScoped ? database : ''
  const scope = JSON.stringify([connectionId, connection?.type, scopeDatabase])
  const databases = databaseList?.connectionId === connectionId ? databaseList.names : []

  function selectConnection(id: string) {
    if (id === connectionId || !connections.some((item) => item.id === id)) return
    sampleRequest.current?.abort()
    latestResult.current = undefined
    setResult(undefined)
    setSelection({ connectionId: id, database: '' })
  }

  useLayoutEffect(() => {
    interval.current = refreshInterval
  }, [refreshInterval])

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
    if (!connectionId) return
    const controller = new AbortController()
    sampleRequest.current = controller
    if (latestResult.current?.scope !== scope) latestResult.current = undefined
    let timer: number | undefined
    let inFlight = false
    let succeeded = false
    const schedule = () => {
      window.clearTimeout(timer)
      if (controller.signal.aborted || inFlight || !interval.current) return
      const baselineOnly = succeeded && latestResult.current?.scope === scope && latestResult.current.history.length === 1
      const delay = baselineOnly ? Math.min(initialSampleDelay, interval.current * 1000) : interval.current * 1000
      timer = window.setTimeout(() => void load(), delay)
    }
    const load = async () => {
      if (controller.signal.aborted || inFlight) return
      inFlight = true
      setLoading(true)
      try {
        const snapshot = await getDatabaseMonitor(connectionId, scopeDatabase, controller.signal)
        if (controller.signal.aborted) return
        const previous = latestResult.current?.scope === scope ? latestResult.current : undefined
        const history = isMonitorReset(previous?.snapshot, snapshot) ? [] : (previous?.history ?? [])
        const next = { scope, snapshot, history: [...history.filter((sample) => sample.sampledAt !== snapshot.sampledAt), snapshot].slice(-maximumHistory) }
        succeeded = true
        latestResult.current = next
        setResult(next)
      } catch (error) {
        if (controller.signal.aborted) return
        const previous = latestResult.current?.scope === scope ? latestResult.current : undefined
        const next = { ...previous, scope, history: previous?.history ?? [], error: error instanceof Error ? error.message : '未读取到数据库统计' }
        succeeded = false
        latestResult.current = next
        setResult(next)
      } finally {
        inFlight = false
        if (!controller.signal.aborted) {
          setLoading(false)
          schedule()
        }
      }
    }
    scheduleNext.current = schedule
    void load()
    return () => {
      controller.abort()
      window.clearTimeout(timer)
      if (scheduleNext.current === schedule) scheduleNext.current = null
      if (sampleRequest.current === controller) sampleRequest.current = null
    }
  }, [connectionId, scopeDatabase, scope, refreshCount])

  useEffect(() => {
    scheduleNext.current?.()
  }, [refreshInterval])

  return {
    connection,
    databases,
    databaseScoped,
    database,
    loading: Boolean(connection) && loading,
    refreshInterval,
    setRefreshInterval,
    selectConnection,
    selectDatabase: (name: string) => {
      if (name === database) return
      sampleRequest.current?.abort()
      latestResult.current = undefined
      setResult(undefined)
      setSelection({ connectionId, database: name })
    },
    result: connection && result?.scope === scope ? result : undefined,
    refresh: () => setRefreshCount((count) => count + 1)
  }
}
