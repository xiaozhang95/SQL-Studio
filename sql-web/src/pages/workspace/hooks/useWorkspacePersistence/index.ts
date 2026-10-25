import { useEffect, useRef, useState } from 'react'

import type { WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { readEncrypted, writeEncrypted } from '@/utils/encryptedStorage'
import { readLocal } from '@/utils/storage'

let restored: Promise<WorkspaceSnapshot | null> | undefined

function validTab(tab: WorkspaceTab) {
  return (
    tab &&
    typeof tab.id === 'string' &&
    typeof tab.sql === 'string' &&
    typeof tab.title === 'string' &&
    typeof tab.connectionId === 'string' &&
    typeof tab.database === 'string' &&
    typeof tab.table === 'string' &&
    ['query', 'data', 'structure', 'ddl'].includes(tab.kind)
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
  let saved = await readEncrypted<WorkspaceSnapshot | null>('workspace', null)
  if (!saved) {
    const legacy = readLocal<WorkspaceTab[]>('sqldesk.tabs', [])
    const tabs = Array.isArray(legacy)
      ? legacy
          .filter((tab) => tab && validTab({ ...tab, kind: tab.kind || 'query' }))
          .map((tab): WorkspaceTab => ({ id: tab.id, title: tab.title, sql: tab.sql, kind: tab.kind || 'query', connectionId: tab.connectionId, database: tab.database, table: tab.table }))
      : []
    saved = {
      version: 1,
      tabs,
      activeTab: readLocal('sqldesk.activeTab', tabs[0]?.id || ''),
      runs: {},
      resultViews: {},
      editorLayouts: {},
      explorer: { expanded: [], selected: [], search: '', top: 0 },
      resultHeight: readLocal('sqldesk.resultHeight', 260),
      openedConnections: [],
      runningTabId: ''
    }
    await writeEncrypted('workspace', saved)
    if (tabs.length) {
      localStorage.removeItem('sqldesk.tabs')
      localStorage.removeItem('sqldesk.activeTab')
    }
  }
  return validate(saved)
}

/** 先恢复再允许保存，避免首次空状态覆盖已有记录；旧明文只在加密提交后移除。 */
export function useWorkspacePersistence(snapshot: WorkspaceSnapshot, restore: (snapshot: WorkspaceSnapshot) => void) {
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
    void writeEncrypted('workspace', snapshot)
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
          setError(reason instanceof Error ? reason.message : '本地加密保存失败')
        }
      })
  }, [ready, snapshot])
  return { ready, saving: ready && savedSnapshot !== snapshot && !error, error }
}
