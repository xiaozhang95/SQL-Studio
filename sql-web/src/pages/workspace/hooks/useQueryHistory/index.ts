import { useCallback, useEffect, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { readState, writeState } from '@/services/userState'
import type { HistoryItem } from '@/typings/workspace'

type Histories = Record<string, HistoryItem[]>
let restored: Promise<Histories> | undefined
// 当前支持范围为 MySQL，旧历史未保存引擎字段，沿用默认适配器读取。
const cleanHistory = getDatabaseAdapter().cleanHistory

async function restoreHistories(): Promise<Histories> {
  const stored = await readState<Histories>('history', async () => ({}))
  if (
    !stored ||
    typeof stored !== 'object' ||
    Array.isArray(stored) ||
    Object.values(stored).some((records) => !Array.isArray(records) || records.some((item) => !item || typeof item.sql !== 'string' || typeof item.connectionId !== 'string'))
  )
    throw new Error('执行历史格式不受支持')
  return Object.fromEntries(Object.entries(stored).map(([id, records]) => [id, records.map((item) => ({ ...item, sql: cleanHistory(item.sql) }))]))
}

/** 当前 SQL 页仅消费自己的记录；持久化由 Go 用户目录配置管理。 */
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
          setError(reason instanceof Error ? reason.message : '无法恢复执行历史')
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
    const timer = window.setTimeout(() => {
      void writeState('history', histories)
        .then(() => {
          restored = Promise.resolve(histories)
          if (!stale) {
            setSavedHistories(histories)
            setError('')
          }
        })
        .catch((reason) => {
          if (!stale) {
            setError(reason instanceof Error ? reason.message : '历史保存失败')
          }
        })
    }, 200)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [ready, available, histories])
  const appendHistory = useCallback((item: HistoryItem) => {
    if (!item.connectionId) return
    setHistories((previous) => ({ ...previous, [item.connectionId]: [{ ...item, sql: cleanHistory(item.sql) }, ...(previous[item.connectionId] || [])].slice(0, 50) }))
  }, [])
  const clearHistory = useCallback((id: string) => {
    if (id) setHistories((previous) => ({ ...previous, [id]: [] }))
  }, [])
  return { history: histories[connectionId] || [], appendHistory, clearHistory, ready, saving: ready && available && savedHistories !== histories && !error, error }
}
