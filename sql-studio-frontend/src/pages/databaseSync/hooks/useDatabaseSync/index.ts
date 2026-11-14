import { useCallback, useEffect, useRef, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import type { DatabaseType } from '@/databases/typings'
import { checkDatabaseSync, listSyncDatabases, runDatabaseSync } from '@/services/databaseSync'
import type { ExternalDatabase, SyncConnection, SyncPlan, SyncProgress, SyncRequest } from '@/services/databaseSync'
import type { Connection } from '@/typings/database'

const initial = { sourceDatabase: '', targetDatabase: '', structure: true, data: false, createDatabase: false }
const initialExternal = (type: DatabaseType): ExternalDatabase => ({ type, host: '', port: 0, username: '', password: '', tls: false })
const emptyCredentials = (type: DatabaseType) => ({ source: initialExternal(type), target: initialExternal(type) })
const initialChoices = { source: '', target: '' }

const externalID = ':external:'
type Side = keyof typeof initialChoices
type Status = 'form' | 'checking' | 'running' | 'completed' | 'error' | 'cancelled'
type Result = { progress: SyncProgress; logs: SyncProgress[]; startedAt: number; endedAt?: number; error?: string }
const emptyProgress: SyncProgress = { phase: 'checking', created: false, completed: 0, tables: 0, skippedViews: 0, rows: 0 }

export function useDatabaseSync(connections: readonly Connection[], initialConnection: Connection | undefined, onCreated: (connectionId: string) => void) {
  const initialEngine = initialConnection?.type ?? DatabaseEngine.MySQL
  const [values, setValues] = useState(initial)
  const [choices, setChoices] = useState(() => ({ ...initialChoices, source: initialConnection?.id ?? '' }))
  const [engine, setEngine] = useState<DatabaseType>(initialEngine)
  const [credentials, setCredentials] = useState(() => emptyCredentials(initialEngine))
  const [status, setStatus] = useState<Status>('form')
  const [plan, setPlan] = useState<SyncPlan>()
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [databases, setDatabases] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [databaseError, setDatabaseError] = useState('')
  const current = useRef<AbortController | null>(null)
  const loadingDatabases = useRef<AbortController | null>(null)
  const profile = getDatabaseAdapter(engine).profile
  const eligibleConnections = connections.filter(({ type }) => (type || DatabaseEngine.MySQL) === engine)

  const canConnect = (side: Side) => {
    const form = credentials[side]
    return choices[side] === externalID
      ? Boolean(form.host.trim() && (profile.optionalUsername || form.username.trim()) && Number.isInteger(form.port) && (form.port === 0 || (form.port >= 1 && form.port <= 65535)))
      : eligibleConnections.some(({ id }) => id === choices[side])
  }
  const endpoint = (side: Side): SyncConnection =>
    choices[side] === externalID ? { external: { ...credentials[side], host: credentials[side].host.trim(), port: credentials[side].port || profile.port } } : { connectionId: choices[side] }

  const cancelList = useCallback(() => {
    loadingDatabases.current?.abort()
    loadingDatabases.current = null
  }, [])
  const readDatabases = useCallback(
    async (input: SyncConnection) => {
      cancelList()
      const controller = new AbortController()
      loadingDatabases.current = controller
      setLoading(true)
      setDatabaseError('')
      try {
        const names = await listSyncDatabases(input, controller.signal)
        if (!controller.signal.aborted) setDatabases(names)
      } catch (error) {
        if (!controller.signal.aborted) setDatabaseError(error instanceof Error ? error.message : '源数据库读取失败')
      } finally {
        if (loadingDatabases.current === controller) {
          loadingDatabases.current = null
          setLoading(false)
        }
      }
    },
    [cancelList]
  )
  const sourceId = eligibleConnections.find(({ id }) => id === choices.source)?.id
  useEffect(() => {
    if (!sourceId) return
    void readDatabases({ connectionId: sourceId })
    return cancelList
  }, [sourceId, readDatabases, cancelList])
  useEffect(
    () => () => {
      loadingDatabases.current?.abort()
      current.current?.abort()
    },
    []
  )

  const invalidate = () => {
    setPlan(undefined)
    setError('')
  }
  const update = (patch: Partial<typeof initial>) => {
    if (current.current) return
    invalidate()
    setValues((previous) => ({
      ...previous,
      ...patch,
      ...('sourceDatabase' in patch && (!previous.targetDatabase || previous.targetDatabase === previous.sourceDatabase) && patch.sourceDatabase ? { targetDatabase: patch.sourceDatabase } : {})
    }))
  }
  const clearSource = () => {
    cancelList()
    setDatabases([])
    setDatabaseError('')
    setLoading(false)
    setValues((previous) => ({ ...previous, sourceDatabase: '', targetDatabase: previous.targetDatabase === previous.sourceDatabase ? '' : previous.targetDatabase }))
  }
  const changeEngine = (next: DatabaseType) => {
    if (current.current || next === engine) return
    invalidate()
    clearSource()
    setEngine(next)
    setChoices(initialChoices)
    setCredentials(emptyCredentials(next))
    setValues(initial)
  }
  const choose = (side: Side, value: string) => {
    if (current.current || choices[side] === value) return
    invalidate()
    if (side === 'source') clearSource()
    setChoices((previous) => ({ ...previous, [side]: value }))
    setCredentials((previous) => ({ ...previous, [side]: initialExternal(engine) }))
  }
  const updateExternal = (side: Side, patch: Partial<ExternalDatabase>) => {
    if (current.current) return
    invalidate()
    if (side === 'source') clearSource()
    setCredentials((previous) => ({ ...previous, [side]: { ...previous[side], ...patch } }))
  }

  const valid =
    values.structure &&
    canConnect('source') &&
    canConnect('target') &&
    Boolean(values.sourceDatabase.trim() && values.targetDatabase.trim()) &&
    (choices.source === externalID || databases.includes(values.sourceDatabase))
  const payload = (): SyncRequest => {
    const source = endpoint('source')
    const target = endpoint('target')
    return {
      ...values,
      sourceDatabase: values.sourceDatabase.trim(),
      targetDatabase: values.targetDatabase.trim(),
      sourceConnectionId: source.connectionId,
      sourceExternal: source.external,
      targetConnectionId: target.connectionId,
      targetExternal: target.external
    }
  }
  const check = async () => {
    if (!valid || current.current) return
    const controller = new AbortController()
    current.current = controller
    setStatus('checking')
    invalidate()
    try {
      const next = await checkDatabaseSync(payload(), controller.signal)
      if (!controller.signal.aborted) setPlan(next)
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '同步检查失败')
    } finally {
      if (current.current === controller) {
        current.current = null
        setStatus('form')
      }
    }
  }
  const run = async () => {
    if (!plan || !valid || current.current) return
    const controller = new AbortController()
    current.current = controller
    const input = payload()
    const startedAt = Date.now()
    let progress = emptyProgress
    setResult({ progress, logs: [progress], startedAt })
    setStatus('running')
    try {
      await runDatabaseSync(input, controller.signal, (next) => {
        const stageChanged = next.phase !== progress.phase || next.table !== progress.table
        progress = next
        setResult((previous) => previous && { ...previous, progress: next, logs: stageChanged ? [...previous.logs.slice(-149), next] : previous.logs })
      })
      setStatus('completed')
    } catch (error) {
      if (controller.signal.aborted) setStatus('cancelled')
      else {
        setStatus('error')
        const message = error instanceof Error ? error.message : '数据库同步失败'
        setResult((previous) => previous && { ...previous, error: message })
      }
    } finally {
      setResult((previous) => previous && { ...previous, endedAt: Date.now() })
      current.current = null
      setCredentials((previous) => ({
        source: { ...previous.source, password: '' },
        target: { ...previous.target, password: '' }
      }))
      if (progress.created && input.targetConnectionId) onCreated(input.targetConnectionId)
    }
  }
  const back = () => {
    if (current.current) return
    setResult(undefined)
    invalidate()
    setStatus('form')
  }
  return {
    back,
    values,
    update,
    status,
    result,
    plan,
    error,
    check,
    run,
    cancel: () => current.current?.abort(),
    profile,
    changeEngine,
    eligibleConnections,
    choices,
    choose,
    credentials,
    externalID,
    updateExternal,
    databases,
    loading,
    databaseError,
    valid,
    canReadSource: canConnect('source'),
    refreshSource: () => {
      if (!current.current && canConnect('source')) void readDatabases(endpoint('source'))
    }
  }
}
