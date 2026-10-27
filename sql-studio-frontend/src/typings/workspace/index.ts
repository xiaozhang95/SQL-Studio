import type { QueryResult } from '../database'

/** 每个查询窗口独立保存范围，避免切换标签时串库。 */
export type QueryScope = { connectionId: string; database: string; table: string }
export type WorkspacePageKind = 'query' | 'data' | 'structure' | 'ddl' | 'table-create' | 'table-design'
export type WorkspaceTab = QueryScope & { id: string; title: string; kind: WorkspacePageKind; sql: string }
export type StatementRun = { sql: string; database?: string; result?: QueryResult; error?: string; durationMs?: number }
export type RunState = {
  scope?: QueryScope
  id?: string
  title?: string
  kind?: WorkspacePageKind
  result?: QueryResult
  error?: string
  source: string
  statements?: StatementRun[]
  statementCount?: number
  startedAt?: string
  endedAt?: string
  durationMs?: number
  interrupted?: boolean
}
export type ResultView = { search: string; page: number; resultIndex: number }
export type EditorLayout = { anchor: number; head: number; top: number; left: number }
export type ExplorerLayout = { expanded: string[]; selected: string[]; search: string; top: number }
export type WorkspaceSnapshot = {
  version: 1
  tabs: WorkspaceTab[]
  activeTab: string
  runs: Record<string, RunState>
  resultViews: Record<string, ResultView>
  editorLayouts: Record<string, EditorLayout>
  explorer: ExplorerLayout
  resultHeight: number
  sidebarWidth?: number
  openedConnections: string[]
  runningTabId: string
}
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
