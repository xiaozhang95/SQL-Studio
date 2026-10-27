import { useCallback, useEffect, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { readState, writeState } from '@/services/userState'
import type { HistoryItem } from '@/typings/workspace'

import { historyLimit, normalizeHistories, retainConnectionHistories } from '../../utils/queryHistory'
import type { Histories } from '../../utils/queryHistory'

let restored: Promise<Histories> | undefined
async function restoreHistories(): Promise<Histories> {
  const stored = await readState<Histories>('history', async () => ({}))
  return normalizeHistories(stored, (sql) => sql)
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
    setHistories((previous) => ({
      ...previous,
      [item.connectionId]: [{ ...item, sql: getDatabaseAdapter(item.databaseType).cleanHistory(item.sql) }, ...(previous[item.connectionId] || [])].slice(0, historyLimit)
    }))
  }, [])
  const clearHistory = useCallback((id: string) => {
    if (id)
      setHistories((previous) =>
        retainConnectionHistories(
          previous,
          Object.keys(previous).filter((key) => key !== id)
        )
      )
  }, [])
  const pruneHistory = useCallback((connectionIds: readonly string[]) => setHistories((previous) => retainConnectionHistories(previous, connectionIds)), [])
  return { history: histories[connectionId] || [], appendHistory, clearHistory, pruneHistory, ready, saving: ready && available && savedHistories !== histories && !error, error }
}
