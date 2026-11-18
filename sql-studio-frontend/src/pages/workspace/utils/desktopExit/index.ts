import type { Connection } from '@/typings/database'
import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'

export type ExitDecision = 'cancel' | 'exit' | 'save'
export interface DesktopExitOptions {
  snapshot: () => WorkspaceSnapshot
  flushEditor: () => void
  draftsFor: (pages: WorkspaceTab[]) => Promise<WorkspaceTab[]>
  activatePage: (id: string) => Promise<void>
  isDirty: (id: string) => boolean
  decide: (page: WorkspaceTab) => Promise<ExitDecision>
  exportSQL: (sql: string, title: string) => Promise<void>
  setPreparing: (preparing: boolean) => void
  setClosing: (closing: boolean) => void
  stop: () => void
  waitForIdle: () => Promise<void>
  persist: (snapshot: WorkspaceSnapshot) => Promise<void>
  connections: () => readonly Connection[]
  closeConnection: (id: string) => Promise<void>
  applyWorkspace: (snapshot: WorkspaceSnapshot) => void
}

function withoutPage(snapshot: WorkspaceSnapshot, id: string): WorkspaceSnapshot {
  const index = snapshot.tabs.findIndex((page) => page.id === id)
  const tabs = snapshot.tabs.filter((page) => page.id !== id)
  const keep = <T>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([key]) => key !== id))
  return {
    ...snapshot,
    tabs,
    activeTab: snapshot.activeTab === id ? tabs[Math.min(index, tabs.length - 1)]?.id || '' : snapshot.activeTab,
    runs: keep(snapshot.runs),
    resultViews: keep(snapshot.resultViews),
    editorLayouts: keep(snapshot.editorLayouts),
    runningTabId: snapshot.runningTabId === id ? '' : snapshot.runningTabId
  }
}

/** Close one page durably at a time; connections stay open until every page has been handled. */
export async function runDesktopExit(options: DesktopExitOptions): Promise<boolean> {
  options.flushEditor()
  options.setPreparing(true)
  let finished = false
  try {
    while (options.snapshot().tabs.length) {
      const snapshot = options.snapshot()
      const target = snapshot.tabs.find((page) => page.id === snapshot.activeTab) ?? snapshot.tabs[0]
      await options.activatePage(target.id)
      options.flushEditor()
      const page = options.snapshot().tabs.find((page) => page.id === target.id)
      if (!page) continue
      const [draft] = page.kind === 'query' ? await options.draftsFor([page]) : [page]
      if (!draft) throw new Error('查询内容读取失败')
      const needsConfirmation = (draft.kind === 'query' && Boolean(draft.sql.trim())) || options.isDirty(draft.id) || options.snapshot().runningTabId === draft.id
      const decision = needsConfirmation ? await options.decide(draft) : 'exit'
      if (decision === 'cancel') return false
      if (decision === 'save') await options.exportSQL(draft.sql, draft.title)
      if (options.snapshot().runningTabId === page.id) {
        options.stop()
        await options.waitForIdle()
      }
      options.flushEditor()
      const next = withoutPage(options.snapshot(), page.id)
      await options.persist(next)
      options.applyWorkspace(next)
    }
    options.setClosing(true)
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
    options.applyWorkspace(empty)
    finished = true
    return true
  } finally {
    if (!finished) {
      options.setClosing(false)
      options.setPreparing(false)
    }
  }
}
