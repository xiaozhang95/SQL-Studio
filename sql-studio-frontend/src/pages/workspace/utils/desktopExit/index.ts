import type { Connection } from '@/typings/database'
import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'

import { sqlForPages } from '../scopeClose/index.ts'

export type ExitDecision = 'cancel' | 'exit' | 'save'
export interface DesktopExitOptions {
  snapshot: () => WorkspaceSnapshot
  flushEditor: () => void
  draftsFor: (pages: WorkspaceTab[]) => Promise<WorkspaceTab[]>
  decide: (sql: string, queries: WorkspaceTab[]) => Promise<ExitDecision>
  exportSQL: (sql: string) => Promise<void>
  setClosing: (closing: boolean) => void
  stop: () => void
  waitForIdle: () => Promise<void>
  persist: (snapshot: WorkspaceSnapshot) => Promise<void>
  connections: () => readonly Connection[]
  closeConnection: (id: string) => Promise<void>
  clearWorkspace: (snapshot: WorkspaceSnapshot) => void
}

/** Confirmation precedes cancellation; durable saves and closes precede the native quit acknowledgement. */
export async function runDesktopExit(options: DesktopExitOptions): Promise<boolean> {
  options.flushEditor()
  const queries = await options.draftsFor(options.snapshot().tabs.filter((page) => page.kind === 'query'))
  const sql = sqlForPages(queries)
  const decision = await options.decide(sql, queries)
  if (decision === 'cancel') return false
  if (decision === 'save') await options.exportSQL(sql)
  options.setClosing(true)
  let finished = false
  try {
    options.stop()
    await options.waitForIdle()
    await options.persist(options.snapshot())
    const connections = [...new Map(options.connections().map((connection) => [connection.id, connection])).values()]
    const failures: string[] = []
    for (let offset = 0; offset < connections.length; offset += 4) {
      const batch = connections.slice(offset, offset + 4)
      const results = await Promise.allSettled(batch.map(({ id }) => options.closeConnection(id)))
      results.forEach((result, index) => {
        if (result.status === 'rejected') failures.push(batch[index].name + ': ' + (result.reason instanceof Error ? result.reason.message : String(result.reason)))
      })
    }
    if (failures.length) throw new Error(failures.join('\n'))
    const snapshot = options.snapshot()
    const expandedGroups = snapshot.explorer.expanded.filter((key) => {
      try {
        const parts: unknown = JSON.parse(key)
        return Array.isArray(parts) && parts.length === 2 && parts[0] === 'group' && typeof parts[1] === 'string'
      } catch {
        return false
      }
    })
    const empty: WorkspaceSnapshot = {
      ...snapshot,
      tabs: [],
      activeTab: '',
      runs: {},
      resultViews: {},
      editorLayouts: {},
      explorer: { expanded: expandedGroups, selected: [], search: '', top: 0 },
      openedConnections: [],
      runningTabId: ''
    }
    await options.persist(empty)
    options.clearWorkspace(empty)
    finished = true
    return true
  } finally {
    if (!finished) options.setClosing(false)
  }
}
