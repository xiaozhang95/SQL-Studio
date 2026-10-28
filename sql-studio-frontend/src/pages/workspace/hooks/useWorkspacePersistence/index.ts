import { useEffect, useRef, useState } from 'react'

import { readState, writeSerializedState } from '@/services/userState'
import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { createLatestWriter } from '@/utils/latestWriter'

import { createWorkspaceSerializer, restoreWorkspaceResults } from '../../utils/workspaceSerialization'

let restored: Promise<WorkspaceSnapshot | null> | undefined

function validTab(tab: WorkspaceTab) {
  return (
    tab &&
    typeof tab.id === 'string' &&
    typeof tab.sql === 'string' &&
    typeof tab.title === 'string' &&
    typeof tab.connectionId === 'string' &&
    typeof tab.database === 'string' &&
    (tab.schema === undefined || typeof tab.schema === 'string') &&
    typeof tab.table === 'string' &&
    ['query', 'data', 'structure', 'ddl', 'table-create', 'table-design'].includes(tab.kind)
  )
}

function validate(snapshot: WorkspaceSnapshot) {
  if (
    snapshot.version !== 1 ||
    !Array.isArray(snapshot.tabs) ||
    !snapshot.tabs.every(validTab) ||
    !snapshot.runs ||
    !snapshot.resultViews ||
    !snapshot.editorLayouts ||
    !snapshot.explorer ||
    !Array.isArray(snapshot.openedConnections)
  )
    throw new Error('本地工作区记录格式不受支持')
  for (const key of [...snapshot.explorer.expanded, ...snapshot.explorer.selected]) {
    const parts: unknown = JSON.parse(key)
    if (!Array.isArray(parts) || !parts.every((part) => typeof part === 'string')) throw new Error('对象树记录格式不受支持')
  }
  return snapshot
}

async function restoreSnapshot() {
  const saved = await readState<WorkspaceSnapshot>('workspace', async () => ({
    version: 1,
    tabs: [],
    activeTab: '',
    runs: {},
    resultViews: {},
    editorLayouts: {},
    explorer: { expanded: [], selected: [], search: '', top: 0 },
    resultHeight: 260,
    openedConnections: [],
    runningTabId: ''
  }))
  return restoreWorkspaceResults(validate(saved))
}

/** 先恢复服务端配置再允许保存，避免首帧空状态覆盖已有工作区；恢复失败时阻止后续覆盖。 */
export function useWorkspacePersistence(snapshot: WorkspaceSnapshot, restore: (snapshot: WorkspaceSnapshot) => void) {
  const [save] = useState(() => {
    const serialize = createWorkspaceSerializer()
    return createLatestWriter<WorkspaceSnapshot>((value) => writeSerializedState('workspace', serialize(value)))
  })
  const dirtySince = useRef<number | null>(null)
  const [ready, setReady] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState('')
  const available = useRef(true)
  const restoreRef = useRef(restore)
  useEffect(() => {
    restoreRef.current = restore
  }, [restore])
  const revision = useRef(0)
  useEffect(() => {
    let stale = false
    async function load() {
      try {
        const saved = await (restored ??= restoreSnapshot())
        if (!stale && saved) restoreRef.current(validate(saved))
      } catch (reason) {
        if (!stale) {
          available.current = false
          setError(reason instanceof Error ? reason.message : '无法恢复本地工作区')
        }
      } finally {
        if (!stale) setReady(true)
      }
    }
    void load()
    return () => {
      stale = true
    }
  }, [])

  useEffect(() => {
    if (!ready || !available.current) return
    const version = ++revision.current
    dirtySince.current ??= Date.now()
    const delay = Math.min(500, Math.max(0, 3000 - (Date.now() - dirtySince.current)))
    const timer = window.setTimeout(() => {
      dirtySince.current = null
      void save(snapshot)
        .then(() => {
          restored = Promise.resolve(snapshot)
          if (version === revision.current) {
            setSavedSnapshot(snapshot)
            setError('')
          }
          localStorage.removeItem('sqldesk.resultHeight')
        })
        .catch((reason) => {
          if (version === revision.current) {
            setError(reason instanceof Error ? reason.message : '本机配置保存失败')
          }
        })
    }, delay)
    return () => window.clearTimeout(timer)
  }, [ready, snapshot, save])
  return { ready, saving: ready && savedSnapshot !== snapshot && !error, error }
}
