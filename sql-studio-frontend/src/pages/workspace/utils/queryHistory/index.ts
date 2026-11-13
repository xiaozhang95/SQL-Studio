import type { HistoryItem } from '@/typings/workspace'

export type Histories = Record<string, HistoryItem[]>
export const historyLimit = 50

/** 读取与追加共用当前历史数量上限。 */
export function normalizeHistories(stored: unknown, cleanSQL: (sql: string) => string): Histories {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('执行历史格式不受支持')
  return Object.fromEntries(
    Object.entries(stored).map(([id, records]) => {
      if (!Array.isArray(records) || records.some((item) => !item || typeof item.sql !== 'string' || item.connectionId !== id)) throw new Error('执行历史格式不受支持')
      return [id, records.slice(0, historyLimit).map((item) => ({ ...item, sql: cleanSQL(item.sql) }))]
    })
  )
}

export function retainConnectionHistories(histories: Histories, connectionIds: readonly string[]): Histories {
  const existing = new Set(connectionIds)
  const entries = Object.entries(histories).filter(([id]) => existing.has(id))
  return entries.length === Object.keys(histories).length ? histories : Object.fromEntries(entries)
}
