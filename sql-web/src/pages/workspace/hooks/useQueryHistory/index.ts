import { useCallback, useEffect, useState } from 'react'

import type { HistoryItem } from '@/typings/workspace'
import { readEncrypted, writeEncrypted } from '@/utils/encryptedStorage'
import { stripHistoryMarkers } from '@/utils/sql'
import { readLocal } from '@/utils/storage'

type Histories = Record<string, HistoryItem[]>
let restored: Promise<Histories> | undefined

async function restoreHistories(): Promise<Histories> {
  const stored = await readEncrypted<Histories | null>('history', null)
  if (stored) {
    if (
      typeof stored !== 'object' ||
      Object.values(stored).some((records) => !Array.isArray(records) || records.some((item) => !item || typeof item.sql !== 'string' || typeof item.connectionId !== 'string'))
    )
      throw new Error('本地执行历史格式不受支持')
    return Object.fromEntries(Object.entries(stored).map(([id, records]) => [id, records.map((item) => ({ ...item, sql: stripHistoryMarkers(item.sql) }))]))
  }
  const keys = Object.keys(localStorage).filter((key) => key === 'sqldesk.history' || key.startsWith('sqldesk.history.'))
  const migrated: Histories = {}
  for (const key of keys) {
    const records = readLocal<HistoryItem[]>(key, [])
    if (!Array.isArray(records)) continue
    for (const item of records) {
      if (!item || typeof item.connectionId !== 'string' || typeof item.sql !== 'string') continue
      const list = (migrated[item.connectionId] ||= [])
      if (!list.some((record) => record.id === item.id))
        list.push({
          id: item.id,
          sql: stripHistoryMarkers(item.sql),
          database: item.database,
          connectionId: item.connectionId,
          connectionName: item.connectionName,
          time: item.time,
          durationMs: item.durationMs,
          ok: item.ok,
          error: item.error
        })
    }
  }
  for (const id of Object.keys(migrated)) migrated[id] = migrated[id].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 50)
  await writeEncrypted('history', migrated)
  // 已确认加密记录提交后才清理旧明文，不因失败丢失旧历史。
  keys.forEach((key) => localStorage.removeItem(key))
  return migrated
}

/** 当前 SQL 页仅消费自己的记录；所有持久化内容均为加密数据。 */
export function useQueryHistory(connectionId: string) {
  const [histories, setHistories] = useState<Histories>({})
  const [ready, setReady] = useState(false)
  const [savedHistories, setSavedHistories] = useState<Histories | null>(null)
  const [error, setError] = useState('')
  const [available, setAvailable] = useState(true)
  useEffect(() => {
    let stale = false
    void (restored ??= restoreHistories())
      .then((records) => {
        if (!stale) setHistories(records)
      })
      .catch((reason) => {
        if (!stale) {
          setAvailable(false)
          setError(reason instanceof Error ? reason.message : '无法恢复加密历史')
        }
      })
      .finally(() => {
        if (!stale) setReady(true)
      })
    return () => {
      stale = true
    }
  }, [])
  useEffect(() => {
    if (!ready || !available) return
    let stale = false
    void writeEncrypted('history', histories)
      .then(() => {
        restored = Promise.resolve(histories)
        if (!stale) {
          setSavedHistories(histories)
          setError('')
        }
      })
      .catch((reason) => {
        if (!stale) {
          setError(reason instanceof Error ? reason.message : '历史加密保存失败')
        }
      })
    return () => {
      stale = true
    }
  }, [ready, available, histories])
  const appendHistory = useCallback((item: HistoryItem) => {
    if (!item.connectionId) return
    setHistories((previous) => ({ ...previous, [item.connectionId]: [{ ...item, sql: stripHistoryMarkers(item.sql) }, ...(previous[item.connectionId] || [])].slice(0, 50) }))
  }, [])
  const clearHistory = useCallback((id: string) => {
    if (id) setHistories((previous) => ({ ...previous, [id]: [] }))
  }, [])
  return { history: histories[connectionId] || [], appendHistory, clearHistory, ready, saving: ready && available && savedHistories !== histories && !error, error }
}
