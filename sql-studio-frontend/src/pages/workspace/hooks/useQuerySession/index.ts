import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { QueryResult } from '@/typings/database'
import type { EditorLayout, ResultView, RunState, WorkspaceTab } from '@/typings/workspace'

/** Query page state and request ownership live together; restoring never executes SQL. */
export function useQuerySession() {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activeTab, setActiveTab] = useState('')
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  const [resultViews, setResultViews] = useState<Record<string, ResultView>>({})
  const [editorLayouts, setEditorLayouts] = useState<Record<string, EditorLayout>>({})
  const [runningTabId, setRunningTabId] = useState('')
  const activeTabRef = useRef('')
  const closedPages = useRef(new Set<string>())
  const pendingDrafts = useRef(new Map<string, string>())
  const request = useRef<AbortController | null>(null)
  const activeRunning = Boolean(runningTabId && runningTabId === activeTab)
  useLayoutEffect(() => {
    for (const [id, sql] of pendingDrafts.current) if (!tabs.some((page) => page.id === id) || tabs.find((page) => page.id === id)?.sql === sql) pendingDrafts.current.delete(id)
  }, [tabs])
  function publishResult(id: string, value: RunState) {
    if (closedPages.current.has(id)) return
    setRuns((previous) => ({ ...previous, [id]: { ...value, id: crypto.randomUUID() } }))
  }
  function replaceTableResult(id: string, result: QueryResult) {
    setRuns((previous) => {
      const run = previous[id]
      if (!run || run.kind !== 'data') return previous
      return {
        ...previous,
        [id]: {
          ...run,
          id: crypto.randomUUID(),
          result,
          error: undefined,
          statements: run.statements?.map((statement, index) => (index === 0 ? { ...statement, result, error: undefined } : statement))
        }
      }
    })
  }
  function startRun(id: string, value: RunState) {
    const controller = new AbortController()
    request.current = controller
    setRunningTabId(id)
    publishResult(id, value)
    setResultViews((previous) => ({ ...previous, [id]: { search: '', page: 1, resultIndex: 0 } }))
    return controller
  }
  function finishRun(controller: AbortController) {
    if (request.current !== controller) return
    request.current = null
    setRunningTabId('')
  }
  const cancelQuery = () => request.current?.abort()
  useEffect(() => () => request.current?.abort(), [])
  return {
    tabs,
    setTabs,
    activeTab,
    setActiveTab,
    activeTabRef,
    runs,
    setRuns,
    resultViews,
    setResultViews,
    editorLayouts,
    setEditorLayouts,
    runningTabId,
    setRunningTabId,
    activeRunning,
    closedPages,
    pendingDrafts,
    request,
    publishResult,
    replaceTableResult,
    startRun,
    finishRun,
    cancelQuery
  }
}
