import type { DatabaseType } from '../../databases/typings/index.ts'
import { fetchResponse, post, readJSON, request } from '../../utils/request/index.ts'

export type ExternalDatabase = { type: DatabaseType; database?: string; host: string; port: number; username: string; password: string; tls: boolean }
export type SyncConnection = { connectionId: string; external?: never } | { connectionId?: never; external: ExternalDatabase }

export type SyncRequest = {
  sourceConnectionId?: string
  sourceExternal?: ExternalDatabase
  sourceDatabase: string
  targetConnectionId?: string
  targetExternal?: ExternalDatabase
  targetDatabase: string
  structure: boolean
  data: boolean
  createDatabase: boolean
}

export type SyncPlan = { tables: number; skippedViews: number }
export type SyncProgress = SyncPlan & { phase: 'checking' | 'created' | 'structure' | 'data' | 'table_done'; table?: string; created: boolean; completed: number; rows: number }

export async function listSyncDatabases(input: SyncConnection, signal: AbortSignal) {
  const names = await request<unknown>('/database-sync/databases', { ...post(input), signal })
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) throw new Error('源数据库读取失败')
  return names as string[]
}

export async function checkDatabaseSync(input: SyncRequest, signal: AbortSignal) {
  const plan = await request<SyncPlan | null>('/database-sync/check', { ...post(input), signal })
  if (!plan || !Number.isSafeInteger(plan.tables) || plan.tables < 1 || !Number.isSafeInteger(plan.skippedViews) || plan.skippedViews < 0) throw new Error('同步检查结果格式无效')
  return plan
}

export async function runDatabaseSync(input: SyncRequest, signal: AbortSignal, onProgress: (progress: SyncProgress) => void) {
  const response = await fetchResponse('/database-sync/run', { ...post(input), headers: { 'Content-Type': 'application/json' }, signal })
  if (!response.ok) await readJSON(response, signal)
  if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) throw new Error('后端未返回有效的同步进度')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let latest: SyncProgress | undefined
  try {
    while (true) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) throw new Error('同步连接提前中断，请检查目标库状态')
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        signal.throwIfAborted()
        if (end > 32 * 1024) throw new Error('同步进度格式无效')
        let event
        try {
          event = JSON.parse(buffer.slice(0, end))
        } catch {
          throw new Error('同步进度格式无效')
        }
        buffer = buffer.slice(end + 1)
        if (event?.type === 'heartbeat') continue
        if (event?.type === 'error' && typeof event.error === 'string') throw new Error(event.error)
        if (event?.type === 'done' && latest?.phase === 'table_done' && latest.created && latest.tables > 0 && latest.completed === latest.tables) return
        const progress = event?.progress
        if (
          event?.type !== 'progress' ||
          !progress ||
          !['checking', 'created', 'structure', 'data', 'table_done'].includes(progress.phase) ||
          typeof progress.created !== 'boolean' ||
          [progress.tables, progress.rows, progress.completed, progress.skippedViews].some((count) => !Number.isSafeInteger(count) || count < 0) ||
          progress.completed > progress.tables ||
          (latest && (progress.rows < latest.rows || progress.completed < latest.completed || (latest.created && (!progress.created || progress.tables !== latest.tables)))) ||
          (progress.table !== undefined && typeof progress.table !== 'string')
        )
          throw new Error('同步进度格式无效')
        latest = progress
        onProgress(progress)
      }
      if (buffer.length > 32 * 1024) throw new Error('同步进度格式无效')
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
