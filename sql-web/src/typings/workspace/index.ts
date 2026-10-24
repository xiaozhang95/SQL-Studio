/** 每个查询窗口独立保存范围，避免切换标签时串库。 */
export type QueryScope = { connectionId: string; database: string; table: string }
export type QueryTab = QueryScope & { id: string; title: string; sql: string }
export type HistoryItem = {
  id: string
  sql: string
  database: string
  connectionId: string
  connectionName: string
  time: string
  durationMs: number
  ok: boolean
  error?: string
}
