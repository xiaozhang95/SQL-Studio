import type { EditorView } from '@codemirror/view'
import { App as AntApp, Button } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectionGroupLabel, connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { getDatabaseAdapter } from '@/databases'
import { selectedRedisDatabase } from '@/databases/redis'
import { DatabaseEngine } from '@/databases/typings'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { ObjectChange, ObjectTarget } from '@/databases/typings/objectManagement'
import { useSidebarWidth } from '@/hooks/useSidebarWidth'
import { useTranslation } from '@/hooks/useTranslation'
import { deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection } from '@/typings/database'
import type { EditorLayout, ExplorerLayout, HistoryItem, QueryScope, WorkspacePageKind, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { exportSQL } from '@/utils/sqlExport'
import { saveSQL } from '@/utils/sqlSave'

import { discardTerminal } from '../../components/redisQuery/utils/terminalSession'
import { resultPanelLayout, scopeCloseDialogLayout } from '../../constant/layout'
import { buildExplorerTree, explorerQueryScope } from '../../utils/explorerTree'
import { canExportDatabase } from '../../utils/exportAvailability'
import { objectNodeKey } from '../../utils/objectTree'
import { resultOutputKey } from '../../utils/queryOutput'
import { pagesForScope, sqlForPages } from '../../utils/scopeClose'
import { reconcileWorkspacePages } from '../../utils/workspacePages'
import {
  explorerAfterChange,
  explorerAfterDatabasesLoaded,
  explorerRoots,
  findExplorerPage,
  pagesAfterSchemaChange,
  pagesForObjectDrop,
  queryScopesAfterChange,
  upsertConnection
} from '../../utils/workspaceTransitions'
import { useConnectionGroups } from '../useConnectionGroups'
import { useDatabaseObjects } from '../useDatabaseObjects'
import { useDataExport } from '../useDataExport'
import { useDesktopExit } from '../useDesktopExit'
import { useObjectManagement } from '../useObjectManagement'
import { useQueryExecution } from '../useQueryExecution'
import { useQueryHistory } from '../useQueryHistory'
import { useQuerySession } from '../useQuerySession'
import { useQueryShortcut } from '../useQueryShortcut'
import { useWorkspaceConnections } from '../useWorkspaceConnections'
import { useWorkspaceEditor } from '../useWorkspaceEditor'
import { useWorkspacePersistence } from '../useWorkspacePersistence'

const emptyScope: QueryScope = { connectionId: '', database: '', schema: '', table: '' }
const emptyTab: WorkspaceTab = { ...emptyScope, id: '', title: '', kind: 'query', sql: '' }

/** 每个主标签就是一个页面；SQL 和结果属于该页面，树操作始终携带独立目标。 */
export const useWorkspace = (active = true) => {
  const { t } = useTranslation()

  const { message, modal } = AntApp.useApp()
  const [refresh, setRefresh] = useState(0)
  const [connectionModal, setConnectionModal] = useState(false)
  const [desktopClosing, setDesktopClosing] = useState(false)
  const [desktopPreparing, setDesktopPreparing] = useState(false)
  const [editing, setEditing] = useState<Connection>()
  const {
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
    activeRunning,
    closedPages,
    pendingDrafts,
    request,
    publishResult,
    replaceTableResult,
    startRun,
    finishRun,
    cancelQuery
  } = useQuerySession()
  const onConnectionsLoaded = useCallback(
    (data: Connection[]) => {
      setTabs((previous) => previous.map((item) => (!item.connectionId || item.kind !== 'query' || data.some((value) => value.id === item.connectionId) ? item : { ...item, ...emptyScope })))
    },
    [setTabs]
  )
  const { connections: savedConnections, setConnections, setSavedGroups, groups, connectionLoading, connectionError, loadConnections } = useWorkspaceConnections(onConnectionsLoaded)
  const connections = useMemo(() => savedConnections.filter((item) => item.type !== DatabaseEngine.Redis), [savedConnections])
  const redisConnections = useMemo(
    () => (connectionLoading || connectionError ? undefined : new Set(savedConnections.filter((item) => item.type === DatabaseEngine.Redis).map((item) => item.id))),
    [connectionLoading, connectionError, savedConnections]
  )
  const [explorer, setExplorer] = useState<ExplorerLayout>({ expanded: [], selected: [], search: '', top: 0 })
  const [resultHeight, setResultHeight] = useState<number>(resultPanelLayout.defaultHeight)
  const { width: sidebarWidth, setWidth: setSidebarWidth, restoreWidth: restoreSidebarWidth } = useSidebarWidth()
  const [restoringConnections, setRestoringConnections] = useState<string[] | null>(null)
  const [objectBusy, setObjectBusy] = useState(false)
  const [designerBusy, setDesignerBusy] = useState<Record<string, boolean>>({})
  const [designerDirty, setDesignerDirty] = useState<Record<string, boolean>>({})
  const [columns, setColumns] = useState<Column[]>([])
  const [ddl, setDDL] = useState('')
  const [structureError, setStructureError] = useState('')
  const [operationError, setOperationError] = useState('')
  const [structureLoading, setStructureLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const editorSession = useWorkspaceEditor({
    layouts: editorLayouts,
    commit: ({ id, sql, layout }) => {
      if (closedPages.current.has(id)) return
      if (sql !== undefined) {
        pendingDrafts.current.set(id, sql)
        setTabs((previous) => previous.map((page) => (page.id === id && page.sql !== sql ? { ...page, sql } : page)))
      }
      if (layout)
        setEditorLayouts((previous) => {
          const saved = previous[id]
          return saved && Object.keys(layout).every((key) => saved[key as keyof EditorLayout] === layout[key as keyof EditorLayout]) ? previous : { ...previous, [id]: layout }
        })
    }
  })
  const editor = editorSession.editor
  const closingScope = useRef(false)
  const tab = tabs.find((item) => item.id === activeTab) || emptyTab
  const { connectionId, database, schema: selectedSchema = '', table: selectedTable } = tab
  const connection = connections.find((item) => item.id === connectionId)
  const redisConnection = savedConnections.find((item) => item.id === connectionId && item.type === DatabaseEngine.Redis)
  const adapter = getDatabaseAdapter(connection?.type)
  const engine = adapter.profile
  const historyStore = useQueryHistory(tab.kind === 'query' ? connectionId : '')
  const { history, appendHistory, clearHistory, pruneHistory } = historyStore
  useEffect(() => {
    // 列表失败/尚未恢复时不能把暂时的空列表当成所有连接已删除。
    if (historyStore.ready && !connectionLoading && !connectionError) pruneHistory(savedConnections.map((item) => item.id))
  }, [historyStore.ready, connectionLoading, connectionError, savedConnections, pruneHistory])
  const validateDatabases = useCallback(
    (id: string, databases: string[]) => {
      setExplorer((previous) => explorerAfterDatabasesLoaded(previous, id, databases))
      setTabs((previous) =>
        previous.map((item) => (item.kind === 'query' && item.connectionId === id && item.database && !databases.includes(item.database) ? { ...item, database: '', schema: '', table: '' } : item))
      )
    },
    [setTabs]
  )
  const schemaConnections = useMemo(() => connections.filter((connection) => getDatabaseAdapter(connection.type).explorer).map((connection) => connection.id), [connections])
  const foreignKeyConnections = useMemo(() => connections.filter((connection) => getDatabaseAdapter(connection.type).foreignKeys).map((connection) => connection.id), [connections])
  const resetConnectionTree = useCallback((id: string) => {
    setExplorer((previous) => explorerAfterDatabasesLoaded(previous, id, []))
  }, [])
  const objects = useDatabaseObjects(connectionId, database, validateDatabases, resetConnectionTree, schemaConnections, foreignKeyConnections)
  const dataExport = useDataExport((id, db) => canExportDatabase(objects.snapshots[id], objects.closedDatabases[id], db))
  const objectManagement = useObjectManagement({ connections, blocked: Boolean(runningTabId), onBusyChange: setObjectBusy, onChanged: onObjectChanged, beforeDrop: confirmObjectDrop })
  const setTableDesignerBusy = useCallback(
    (id: string, value: boolean) =>
      setDesignerBusy((previous) => {
        if (Boolean(previous[id]) === value) return previous
        const next = { ...previous }
        if (value) next[id] = true
        else delete next[id]
        return next
      }),
    []
  )
  const setTableDesignerDirty = useCallback(
    (id: string, value: boolean) =>
      setDesignerDirty((previous) => {
        if (Boolean(previous[id]) === value) return previous
        const next = { ...previous }
        if (value) next[id] = true
        else delete next[id]
        return next
      }),
    []
  )
  const tableDesignerCommitted = useCallback(
    (id: string, change: ObjectChange) =>
      setTabs((previous) => previous.map((page) => (page.id === id ? { ...page, kind: 'table-design', table: change.name, title: change.name + t(' · 设计') } : page))),
    [setTabs, t]
  )
  function isTableDesignerBlocked(page: WorkspaceTab) {
    return (
      Boolean(runningTabId) ||
      objectBusy ||
      connectionGroups.saving ||
      Boolean(connectionGroups.dialog) ||
      Boolean(objectManagement.dialog) ||
      Object.entries(designerBusy).some(([id, busy]) => id !== page.id && busy) ||
      objects.snapshots[page.connectionId]?.status !== 'connected'
    )
  }
  const { loadStructure, loadTables, openConnection: openObjectsConnection } = objects
  useEffect(() => {
    if (tab.kind === 'query' && !redisConnection && objects.connected && database) void loadTables(database, connectionId).catch(() => {})
  }, [tab.kind, redisConnection, objects.connected, database, connectionId, loadTables])
  const resultIndex = resultViews[activeTab]?.resultIndex || 0
  const resultSetIndex = resultViews[activeTab]?.resultSetIndex ?? 0
  const batch = runs[activeTab]
  const statementRun = batch?.statements?.[resultIndex]
  const statementResult = statementRun ? statementRun.result : batch?.result
  const result = statementResult?.additionalResults?.[resultSetIndex - 1] ?? statementResult
  const run = statementRun
    ? { ...batch, result, error: statementRun.error, cancelled: statementRun.cancelled, id: `${batch.id}:${resultOutputKey(resultIndex, resultSetIndex)}` }
    : batch
  const resultSearch = resultViews[activeTab]?.search || ''
  const openedKey = JSON.stringify(
    Object.keys(objects.snapshots)
      .filter((id) => objects.snapshots[id].status === 'connected')
      .sort()
  )
  const openedConnections = useMemo(() => JSON.parse(openedKey) as string[], [openedKey])
  const snapshot = useMemo<WorkspaceSnapshot>(
    () => ({
      version: 1,
      tabs,
      activeTab,
      runs,
      resultViews,
      editorLayouts,
      explorer: explorerRoots(explorer, restoringConnections || openedConnections),
      resultHeight,
      sidebarWidth,
      openedConnections: restoringConnections || openedConnections,
      runningTabId
    }),
    [tabs, activeTab, runs, resultViews, editorLayouts, explorer, resultHeight, sidebarWidth, restoringConnections, openedConnections, runningTabId]
  )
  const queryRunning = Boolean(runningTabId)
  const uiBlocked = desktopPreparing || objectBusy || Boolean(objectManagement.dialog) || Object.values(designerBusy).some(Boolean) || connectionModal
  const storage = useWorkspacePersistence(
    snapshot,
    (saved) => {
      editorSession.discard(new Set(tabs.map(({ id }) => id)))
      pendingDrafts.current.clear()
      closedPages.current.clear()
      setTabs(saved.tabs)
      const active = saved.tabs.some((item) => item.id === saved.activeTab) ? saved.activeTab : saved.tabs[0]?.id || ''
      setActiveTab(active)
      activeTabRef.current = active
      setRuns(saved.runs)
      setResultViews(saved.resultViews)
      setEditorLayouts(saved.editorLayouts)
      objects.retainConnections(new Set(saved.openedConnections))
      resetStructure()
      setExplorer(explorerRoots(saved.explorer, saved.openedConnections))
      setResultHeight(Number.isFinite(saved.resultHeight) ? Math.max(resultPanelLayout.minimumHeight, saved.resultHeight) : resultPanelLayout.defaultHeight)
      restoreSidebarWidth(saved.sidebarWidth)
      setRestoringConnections(saved.openedConnections)
    },
    {
      busy: queryRunning || uiBlocked || Object.values(designerDirty).some(Boolean),
      redisConnections,
      hydrate: ({ id, sql, run, expectedSQL, expectedRun }) => {
        setTabs((previous) => previous.map((page) => (page.id === id && page.sql === expectedSQL ? { ...page, sql } : page)))
        setRuns((previous) => {
          if (closedPages.current.has(id) || previous[id] !== expectedRun) return previous
          if (!run) return previous
          return { ...previous, [id]: run }
        })
      },
      evict: (ids, expected) => {
        const removed = new Set(
          ids.filter(
            (id) => id !== activeTabRef.current && id !== runningTabId && (!pendingDrafts.current.has(id) || pendingDrafts.current.get(id) === expected.tabs.find((page) => page.id === id)?.sql)
          )
        )
        if (!removed.size) return []
        setTabs((previous) =>
          previous.map((page) => {
            if (!removed.has(page.id) || page.sql !== expected.tabs.find((item) => item.id === page.id)?.sql) return page
            const run = expected.runs[page.id]
            const output = run?.statements?.[expected.resultViews[page.id]?.resultIndex || 0] ?? run
            return { ...page, sql: '', resultStatus: output?.error ? 'error' : output?.result ? 'success' : page.resultStatus, resultSource: run?.source ?? page.resultSource }
          })
        )
        setRuns((previous) => {
          const next = { ...previous }
          let changed = false
          for (const id of removed)
            if (previous[id] && previous[id] === expected.runs[id]) {
              delete next[id]
              changed = true
            }
          return changed ? next : previous
        })
        return [...removed]
      }
    }
  )
  const connectionGroups = useConnectionGroups({
    groups,
    blocked:
      Boolean(runningTabId) || objectBusy || Boolean(objectManagement.dialog) || Object.values(designerBusy).some(Boolean) || !storage.pageReady || connectionLoading || Boolean(connectionError),
    onGroupsChanged: setSavedGroups,
    onMoved: (saved) => setConnections((previous) => upsertConnection(previous, saved)),
    onDeleted: (name) => {
      setConnections((previous) => previous.map((item) => (connectionGroupName(item.group) === name ? { ...item, group: defaultConnectionGroup } : item)))
      const oldKey = JSON.stringify(['group', name])
      setExplorer((previous) => ({ ...previous, expanded: previous.expanded.filter((key) => key !== oldKey), selected: previous.selected.filter((key) => key !== oldKey) }))
    },
    onRenamed: (name, newName) => {
      setConnections((previous) => previous.map((item) => (connectionGroupName(item.group) === name ? { ...item, group: newName } : item)))
      const oldKey = JSON.stringify(['group', name]),
        newKey = JSON.stringify(['group', newName])
      setExplorer((previous) => ({ ...previous, expanded: previous.expanded.map((key) => (key === oldKey ? newKey : key)), selected: previous.selected.map((key) => (key === oldKey ? newKey : key)) }))
    }
  })
  const tabsBlocked = uiBlocked || connectionGroups.saving || Boolean(connectionGroups.dialog)
  const tabBusy = queryRunning || tabsBlocked
  const running = tabBusy || !storage.pageReady
  const workspaceReady = storage.ready && historyStore.ready
  const saving = storage.saving || editorSession.pending || historyStore.saving
  useEffect(() => {
    if (desktopPreparing || desktopClosing || !storage.ready || connectionLoading || connectionError || !restoringConnections) return
    let stale = false
    const restored = savedConnections.filter((item) => restoringConnections.includes(item.id))
    void Promise.resolve().then(() => {
      if (stale) return
      setRestoringConnections(null)
      for (const { id } of restored) void openObjectsConnection(id).catch(() => {})
      setTabs((previous) =>
        previous.map((item) => (item.kind === 'query' && item.connectionId && !savedConnections.some((connection) => connection.id === item.connectionId) ? { ...item, ...emptyScope } : item))
      )
    })
    return () => {
      stale = true
    }
  }, [desktopPreparing, desktopClosing, storage.ready, connectionLoading, connectionError, restoringConnections, savedConnections, openObjectsConnection, setTabs])

  const redisConnectionStatus = redisConnection ? objects.snapshots[redisConnection.id]?.status : undefined
  const redisDatabase = redisConnection ? selectedRedisDatabase(objects.databases, database, redisConnection.database) : undefined
  const selectRedisDatabase = useCallback(
    (pageId: string, id: string, database: string) => {
      if (closedPages.current.has(pageId)) return
      setTabs((previous) => previous.map((page) => (page.id === pageId && page.kind === 'query' && page.connectionId === id && page.database !== database ? { ...page, database } : page)))
    },
    [closedPages, setTabs]
  )
  useEffect(() => {
    if (!desktopPreparing && !desktopClosing && active && storage.ready && storage.pageReady && redisConnection && !redisConnectionStatus)
      void openObjectsConnection(redisConnection.id).catch(() => {})
  }, [desktopPreparing, desktopClosing, active, storage.ready, storage.pageReady, redisConnection, redisConnectionStatus, openObjectsConnection])
  useEffect(() => {
    if (storage.pageReady && !database && redisDatabase !== undefined) selectRedisDatabase(tab.id, connectionId, redisDatabase)
  }, [storage.pageReady, database, redisDatabase, selectRedisDatabase, tab.id, connectionId])

  const reconciledTabs = useMemo(
    () =>
      reconcileWorkspacePages(tabs, {
        validateSchemas: !objectBusy,
        snapshots: objects.snapshots
      }),
    [tabs, objectBusy, objects.snapshots]
  )
  // 只调整当前组件自身状态；引用守卫确保校正后下一次渲染稳定。
  if (reconciledTabs !== tabs) setTabs(reconciledTabs)

  function updateExplorer(patch: Partial<ExplorerLayout>) {
    setExplorer((previous) => ({ ...previous, ...patch }))
  }

  useEffect(() => {
    if (tab.kind !== 'query' || !objects.connected || !connectionId || !database || !objects.databases.includes(database) || !selectedTable) return
    let stale = false
    loadStructure(database, selectedTable, connectionId)
      .then((structure) => {
        if (!stale) {
          setColumns(structure.columns)
          setDDL(structure.ddl)
        }
      })
      .catch((error) => {
        if (!stale) setStructureError(error.message)
      })
      .finally(() => {
        if (!stale) setStructureLoading(false)
      })
    return () => {
      stale = true
    }
  }, [activeTab, tab.kind, connectionId, database, selectedTable, refresh, objects.connected, objects.databases, loadStructure])
  useQueryShortcut({ enabled: active && !running && storage.pageReady && !connectionModal && !historyOpen && tab.kind === 'query' && !redisConnection, editor, run: runSQL })

  function resetStructure(loading = false) {
    setColumns([])
    setDDL('')
    setStructureError('')
    setStructureLoading(loading)
  }
  function setResultSearch(search: string) {
    setResultViews((previous) => ({ ...previous, [activeTab]: { ...(previous[activeTab] ?? { resultIndex: 0 }), search } }))
  }
  function selectResult(index: number, resultSetIndex = 0) {
    if (activeRunning || !batch?.statements?.[index]) return
    setResultViews((previous) => ({ ...previous, [activeTab]: { search: '', resultIndex: index, ...(resultSetIndex ? { resultSetIndex } : {}) } }))
  }
  function updateTab(patch: Partial<WorkspaceTab>) {
    if (!tab.id || tab.kind !== 'query' || !storage.pageReady) return
    setTabs((previous) => previous.map((item) => (item.id === activeTab ? { ...item, ...patch } : item)))
  }
  const updateSQL = (sql: string) => updateTab({ sql })
  function getCurrentSQL() {
    const change = editorSession.flush()
    return change?.id === activeTabRef.current && change.sql !== undefined ? change.sql : editorSession.read(activeTabRef.current, tab.sql)
  }
  async function exportCurrentSQL() {
    const sql = getCurrentSQL()
    if (!sql.trim()) return
    try {
      if (window.sqlStudioDesktop?.saveFile?.append) await saveSQL(sql, tab.title)
      else exportSQL(sql, tab.title)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setOperationError(t('SQL 导出失败，请重试'))
    }
  }
  function openHistory() {
    if (tab.kind !== 'query' || (!connection && !redisConnection)) return
    setHistorySearch('')
    setHistoryOpen(true)
  }
  function loadHistory(item: HistoryItem) {
    if (running || request.current || tab.kind !== 'query' || !tab.id || item.connectionId !== connectionId) return
    const view = editor.current
    const current = view?.state.doc.toString() ?? tab.sql
    // 仅追加到当前 SQL 页，不替换草稿、不改变库范围，也不自动执行历史语句。
    const prefix = current.trim() ? (current.endsWith('\n') ? '\n' : '\n\n') : ''
    const redisCommand = item.sql.endsWith(';') ? item.sql + ' ;' : item.sql
    const insert = prefix + (redisConnection ? `# 历史记录\n${redisCommand}` : `-- 历史记录\n${adapter.cleanHistory(item.sql)}`)
    if (view) {
      view.dispatch({ changes: { from: current.length, insert }, selection: { anchor: current.length + insert.length }, scrollIntoView: true })
      requestAnimationFrame(() => view.focus())
    } else updateSQL(current + insert)
    setHistoryOpen(false)
  }
  function selectTab(id: string, discard = false) {
    if (desktopPreparing && !discard) return
    if (id === activeTabRef.current) {
      editorSession.flush()
      return
    }
    if (id !== activeTab && tab.kind === 'data' && designerDirty[activeTab] && !discard) {
      modal.confirm({ title: t('放弃当前表的未保存修改？'), okText: t('放弃并切换'), cancelText: t('继续编辑'), onOk: () => selectTab(id, true) })
      return
    }
    const next = tabs.find((item) => item.id === id)
    editorSession.detach()
    activeTabRef.current = id
    setActiveTab(id)
    resetStructure(next?.kind === 'query' && Boolean(next.table))
    setHistoryOpen(false)
    setHistorySearch('')
  }
  function createPage(kind: WorkspacePageKind, scope: QueryScope, title: string, sql = '', discard = false) {
    const added: WorkspaceTab = { ...scope, id: crypto.randomUUID(), kind, title, sql }
    setTabs((previous) => [...previous, added])
    selectTab(added.id, discard)
    return added.id
  }
  function addTab(statement = '', scope?: QueryScope, title?: string) {
    if (running || request.current) return
    return createPage('query', scope || emptyScope, title || t('查询 {value1}', { value1: tabs.filter((item) => item.kind === 'query').length + 1 }), statement)
  }
  function newQuery() {
    const layouts = Object.fromEntries(connections.map((item) => [item.id, getDatabaseAdapter(item.type).explorer]))
    const tree = buildExplorerTree(savedConnections, objects.snapshots, explorer.expanded, explorer.search, layouts, connectionGroups.groups, objects.closedDatabases, (group) =>
      connectionGroupLabel(group, t)
    )
    const node = tree.byKey.get(explorer.selected[0])
    const scope = explorerQueryScope(
      node,
      Boolean(node && (node.connection?.type === DatabaseEngine.Redis || objects.snapshots[node.owner]?.status === 'connected')),
      node ? layouts[node.owner] : undefined
    )
    addTab('', scope)
  }
  function openRedisQuery(id: string, db?: string) {
    if (running || request.current) return
    const target = savedConnections.find((item) => item.id === id && item.type === DatabaseEngine.Redis)
    if (!target) return
    const database = db ?? target.database ?? ''
    const existing = tabs.find((page) => page.kind === 'query' && page.connectionId === id && (db === undefined || page.database === db))
    if (existing) selectTab(existing.id)
    else addTab('', { connectionId: id, database, table: '' })
  }
  function openTableDesigner(kind: 'table-create' | 'table-design', scope: QueryScope) {
    const existing =
      kind === 'table-design' ? tabs.find((page) => page.kind === kind && page.connectionId === scope.connectionId && page.database === scope.database && page.table === scope.table) : undefined
    if (existing) {
      selectTab(existing.id)
      return
    }
    const number = Math.max(0, ...tabs.filter((page) => page.kind === 'table-create').map((page) => Number(page.title.match(/^新建表 (\d+)/)?.[1]) || 0)) + 1
    createPage(kind, scope, kind === 'table-create' ? t('新建表 ') + number + ' · ' + scope.database : scope.table + t(' · 设计'))
  }
  function selectConnection(id: string) {
    const target = savedConnections.find((item) => item.id === id)
    if (running || !storage.pageReady || !target || id === connectionId) return
    const snapshot = objects.snapshots[id]
    const db = target.type === DatabaseEngine.Redis ? (selectedRedisDatabase(snapshot?.databases ?? [], undefined, target.database) ?? '') : ''
    editorSession.flush()
    updateTab({ connectionId: id, database: db, schema: '', table: '', resultStatus: undefined, resultSource: undefined })
    const withoutActiveResult = <T,>(records: Record<string, T>) => {
      if (!(activeTab in records)) return records
      const next = { ...records }
      delete next[activeTab]
      return next
    }
    setRuns(withoutActiveResult)
    setResultViews(withoutActiveResult)
    setHistoryOpen(false)
    resetStructure()
    if (snapshot?.status !== 'connected') void openObjectsConnection(id).catch(() => {})
  }
  function selectObject(db: string, table?: string, id = connectionId, schema = '') {
    if (running || objects.snapshots[id]?.status !== 'connected') return
    if (id !== connectionId || db !== database || (table || '') !== selectedTable) resetStructure(Boolean(table))
    updateTab({ connectionId: id, database: db, schema, table: table || '' })
  }
  function openConnection(id: string) {
    return running ? Promise.resolve([]) : objects.openConnection(id)
  }
  function refreshSchema(id = connectionId) {
    if (!id || running) return
    if (id === connectionId) {
      resetStructure(Boolean(selectedTable))
      setRefresh((value) => value + 1)
    }
    void objects.refreshConnection(id).catch(() => {})
  }
  async function refreshObjectTarget(id: string, db: string) {
    await objects.refreshDatabases(id)
    if (db) await objects.refreshTables(db, id, true)
  }
  function removePages(removed: ReadonlySet<string>, nextId: string) {
    if (!removed.size) return
    for (const id of removed) {
      closedPages.current.add(id)
      discardTerminal(id)
      pendingDrafts.current.delete(id)
    }
    editorSession.discard(removed)
    const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => !removed.has(id)))
    setTabs((previous) => previous.filter((page) => !removed.has(page.id)))
    setRuns(keep)
    setResultViews(keep)
    setEditorLayouts(keep)
    setDesignerBusy(keep)
    setDesignerDirty(keep)
    if (removed.has(activeTabRef.current)) selectTab(nextId, true)
  }
  async function confirmPageClosure(pages: WorkspaceTab[], { db, dropping = false, signal }: { db?: string; dropping?: boolean; signal?: AbortSignal }) {
    if (!pages.length) return true
    editorSession.flush()
    const scoped = pages.map((page) => (page.kind === 'query' ? { ...page, sql: editorSession.read(page.id, page.sql) } : page))
    const affected = await storage.draftsFor(scoped, signal)
    const sql = sqlForPages(affected)
    const dirty = affected.filter((page) => designerDirty[page.id])
    if (!sql && !dirty.length) return true
    const titles = affected.map((page) => page.title).join('、')
    return new Promise<boolean>((resolve) => {
      function finish(proceed: boolean) {
        signal?.removeEventListener('abort', abort)
        resolve(proceed)
      }
      function abort() {
        dialog.destroy()
        finish(false)
      }
      const dialog = modal.confirm({
        width: scopeCloseDialogLayout.width,
        title: sql ? t(dropping ? '删除前是否保存关联查询？' : '关闭前是否保存查询？') : t('关闭前请确认未保存的修改'),
        content: (
          <>
            <p>{dropping ? t('删除成功后将关闭 {value1}。', { value1: titles }) : titles + ' ' + t(' 将随') + (db ? t('数据库') : t('连接')) + t('一起关闭。')}</p>
            {sql && <p>{t('查询内容将保存为一个 .sql 文件。')}</p>}
            {dirty.length > 0 && (
              <p>
                {dirty.map((page) => page.title).join('、')} {t(' 的表结构或数据修改尚未提交，继续关闭将放弃这些修改；SQL 文件不包含这些修改。')}
              </p>
            )}
          </>
        ),
        okText: sql ? t(dropping ? '保存并继续' : '保存并关闭') : t(dropping ? '放弃并继续' : '放弃并关闭'),
        cancelText: t('取消'),
        onCancel: () => finish(false),
        onOk: async () => {
          try {
            if (sql) await saveSQL(sql, db || t('SQL Studio 查询'))
            finish(true)
          } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) setOperationError(t('SQL 保存失败，窗口已保留'))
            throw error
          }
        },
        footer: (_, { OkBtn, CancelBtn }) => (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <CancelBtn />
            {sql && (
              <Button
                onClick={() => {
                  finish(true)
                  dialog.destroy()
                }}
              >
                {t('不保存')}
              </Button>
            )}
            <OkBtn />
          </div>
        )
      })
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
    })
  }
  function confirmObjectDrop(action: ObjectAction, target: ObjectTarget, signal: AbortSignal) {
    return confirmPageClosure(pagesForObjectDrop(tabs, action, target), { db: target.database, dropping: true, signal })
  }
  async function onObjectChanged({ action, target, name }: ObjectChange) {
    const change = { action, target, name }
    if ([ObjectAction.CreateSchema, ObjectAction.RenameSchema, ObjectAction.DropSchema].some((value) => value === action)) {
      const engine = getDatabaseAdapter(connections.find((connection) => connection.id === target.connectionId)?.type).explorer
      if (!engine) throw new Error(t('无法识别 Schema 所属引擎'))
      await objects.refreshTables(target.database, target.connectionId, true)
      setTabs((previous) => pagesAfterSchemaChange(previous, change, engine))
      setExplorer((previous) => explorerAfterChange(previous, change, engine))
      if (connectionId === target.connectionId && database === target.database) {
        resetStructure()
        setRefresh((value) => value + 1)
      }
      return
    }
    const removed = new Set(pagesForObjectDrop(tabs, action, target).map((page) => page.id))
    const activeRemoved = removed.has(activeTabRef.current)
    if (removed.size) removePages(removed, tabs.find((page) => !removed.has(page.id))?.id || '')
    setTabs((previous) => queryScopesAfterChange(previous, change))
    setExplorer((previous) => explorerAfterChange(previous, change))
    if (!activeRemoved && connectionId === target.connectionId && database === target.database && (!target.table || selectedTable === target.table)) {
      resetStructure()
      setRefresh((value) => value + 1)
    }
    if ([ObjectAction.CreateDatabase, ObjectAction.EditDatabase, ObjectAction.DropDatabase].some((value) => value === action)) await objects.refreshDatabases(target.connectionId)
    else await objects.refreshTables(target.database, target.connectionId)
  }
  async function closeScope(id: string, db?: string) {
    if (closingScope.current) return false
    if (objectBusy || objectManagement.dialog || Object.values(designerBusy).some(Boolean)) {
      message.info(t('请等待当前对象操作完成后再关闭'))
      return false
    }
    closingScope.current = true
    setObjectBusy(true)
    const scoped = pagesForScope(tabs, id, db)
    try {
      if (!(await confirmPageClosure(scoped, { db }))) return false
      const activeScope = runs[runningTabId]?.scope || tabs.find((page) => page.id === runningTabId)
      if (activeScope?.connectionId === id && (db === undefined || activeScope.database === db)) request.current?.abort()
      if (dataExport.busy && dataExport.state?.connectionId === id && (db === undefined || dataExport.state.database === db)) dataExport.cancel()
      // 只有服务端确认驱动资源已释放后，才删除窗口和本地元数据。
      if (db === undefined) await objects.closeConnection(id)
      else await objects.closeDatabase(id, db)
      const removed = new Set(scoped.map((page) => page.id))
      removePages(removed, tabs.find((page) => !removed.has(page.id))?.id || '')
      setExplorer((previous) => ({
        ...previous,
        expanded: previous.expanded.filter((key) => {
          const [, owner, name] = JSON.parse(key) as string[]
          return owner !== id || (db !== undefined && name !== db)
        }),
        selected: [JSON.stringify(db === undefined ? ['connection', id] : ['database', id, db])]
      }))
      return true
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : t('关闭失败，窗口已保留'))
      return false
    } finally {
      closingScope.current = false
      setObjectBusy(false)
    }
  }
  function connectionAction(action: string, id: string) {
    if (action === 'close') {
      void closeScope(id)
      return
    }
    if (running) return
    const target = savedConnections.find((item) => item.id === id)
    if (!target) return
    if (action === 'create-database') void objectManagement.open(ObjectAction.CreateDatabase, { connectionId: id, database: '', table: '' })
    else if (action === 'open') {
      const group = objectNodeKey('group', connectionGroupName(target.group))
      const connection = objectNodeKey('connection', id)
      setExplorer((previous) =>
        previous.expanded.includes(group) && previous.expanded.includes(connection) ? previous : { ...previous, expanded: [...new Set([...previous.expanded, group, connection])] }
      )
      void openConnection(id).catch(() => {})
    } else if (action === 'refresh') refreshSchema(id)
    else if (action === 'edit') {
      setEditing(target)
      setConnectionModal(true)
    } else if (action === 'delete') deleteConnection(id)
  }
  async function databaseAction(action: string, id: string, db: string, reuseTabId?: string, schema?: string, refresh = false, discard = false) {
    if (action === 'close') {
      await closeScope(id, db)
      return
    }
    if (running || request.current || objects.snapshots[id]?.status !== 'connected') return
    if (action === 'open') {
      try {
        await objects.loadTables(db, id)
        setExplorer((previous) => ({ ...previous, expanded: [...new Set([...previous.expanded, JSON.stringify(['database', id, db])])] }))
      } catch (error) {
        setOperationError(error instanceof Error ? error.message : t('打开数据库失败'))
      }
      return
    }
    if (action === 'dump' || action === 'dump-data') {
      const target = connections.find((item) => item.id === id)
      if (target) void dataExport.start(target, db, action === 'dump-data', undefined, schema)
      return
    }
    const scope = { connectionId: id, database: db, schema, table: '' }
    const actions: Partial<Record<string, ObjectAction>> = {
      create: ObjectAction.CreateDatabase,
      edit: ObjectAction.EditDatabase,
      delete: ObjectAction.DropDatabase,
      'create-table': ObjectAction.CreateTable,
      'create-schema': ObjectAction.CreateSchema,
      'rename-schema': ObjectAction.RenameSchema,
      'delete-schema': ObjectAction.DropSchema
    }
    const objectAction = actions[action]
    if (objectAction) {
      const adapter = getDatabaseAdapter(connections.find((connection) => connection.id === id)?.type)
      if (
        !adapter.objects &&
        !(objectAction === ObjectAction.EditDatabase && adapter.databaseEditor) &&
        !(objectAction === ObjectAction.CreateTable && adapter.tableDesign && schema) &&
        !adapter.simpleObjects?.actions.includes(objectAction)
      )
        return
      if (
        (objectAction === ObjectAction.RenameSchema || objectAction === ObjectAction.DropSchema) &&
        tabs.some((page) => page.connectionId === id && page.database === db && page.schema === schema && (page.kind === 'table-design' || page.kind === 'table-create' || designerDirty[page.id]))
      ) {
        message.info(t('请先保存或关闭此 Schema 中的表设计及未保存的数据修改'))
        return
      }
      if (objectAction === ObjectAction.CreateTable) {
        openTableDesigner('table-create', scope)
        return
      }
      void objectManagement.open(objectAction, scope)
      return
    }
    if (action === 'new') {
      addTab('', scope)
      return
    }
    if (action === 'refresh') {
      try {
        await refreshObjectTarget(id, db)
      } catch (reason) {
        setOperationError(reason instanceof Error ? reason.message : t('刷新失败'))
      }
      return
    }
    if (action !== 'tables') return
    const title = t('{value1}{value2} · 结构', { value1: db, value2: schema ? ' / ' + schema : '' })
    const tabId = reuseTabId || createPage('structure', scope, title, '', discard)
    const source = `${connections.find((item) => item.id === id)?.name || ''} / ${db}${schema ? ' / ' + schema : ''}`
    const controller = startRun(tabId, { kind: 'structure', title, source })
    try {
      const tables = await (refresh ? objects.refreshTables(db, id, true) : objects.loadTables(db, id))
      const adapter = getDatabaseAdapter(connections.find((connection) => connection.id === id)?.type)
      const listing = adapter.explorer && !schema ? adapter.explorer.schemaListResult(await objects.loadSchemas(db, id)) : adapter.tableListResult(tables, schema)
      if (controller.signal.aborted) throw new Error(t('请求已取消'))
      publishResult(tabId, {
        kind: 'structure',
        title,
        source,
        result: {
          ...listing,
          rowCount: listing.rows.length,
          affectedRows: 0,
          lastInsertId: '',
          durationMs: 0,
          truncated: false,
          isQuery: true
        }
      })
    } catch (error) {
      publishResult(tabId, { kind: 'structure', title, source, error: error instanceof Error ? error.message : t('数据库结构加载失败') })
    } finally {
      finishRun(controller)
    }
  }
  function openExplorerPage(kind: 'data' | 'structure', id: string, db: string, table = '', schema?: string) {
    if (running || request.current) return
    const existing = findExplorerPage(tabs, kind, id, db, table, schema)
    const open = () => {
      if (existing) selectTab(existing.id, true)
      if (kind === 'data') void tableAction('data', id, db, table, existing?.id, true)
      else void databaseAction('tables', id, db, existing?.id, schema, Boolean(existing), true)
    }
    const dirtyCurrent = tab.kind === 'data' && Boolean(designerDirty[activeTab])
    const dirtyTarget = existing?.kind === 'data' && Boolean(designerDirty[existing.id])
    if (dirtyCurrent || dirtyTarget) {
      modal.confirm({ title: t('放弃表格中未保存的修改？'), content: t('刷新或切换页面会放弃未保存的修改。'), okText: t('放弃并继续'), cancelText: t('继续编辑'), onOk: open })
    } else open()
  }
  async function tableAction(action: string, targetConnectionId: string, db: string, table: string, reuseTabId?: string, discard = false) {
    const target = connections.find((item) => item.id === targetConnectionId)
    if (running || request.current || !target || objects.snapshots[targetConnectionId]?.status !== 'connected') return
    const scope: QueryScope = {
      connectionId: targetConnectionId,
      database: db,
      schema: getDatabaseAdapter(target.type).explorer?.tableIdentity(table).schema,
      table
    }
    const actions: Partial<Record<string, ObjectAction>> = {
      design: ObjectAction.EditTable,
      create: ObjectAction.CreateTable,
      delete: ObjectAction.DropTable,
      truncate: ObjectAction.TruncateTable,
      rename: ObjectAction.RenameTable
    }
    const objectAction = actions[action]
    if (objectAction) {
      const adapter = getDatabaseAdapter(target.type)
      if (
        !adapter.objects &&
        !([ObjectAction.CreateTable, ObjectAction.EditTable].some((value) => value === objectAction) && adapter.tableDesign) &&
        !adapter.simpleObjects?.actions.includes(objectAction)
      )
        return
      if (objectAction === ObjectAction.CreateTable || objectAction === ObjectAction.EditTable) {
        openTableDesigner(objectAction === ObjectAction.CreateTable ? 'table-create' : 'table-design', { ...scope, table: objectAction === ObjectAction.CreateTable ? '' : table })
        return
      }
      void objectManagement.open(objectAction, {
        ...scope,
        view: Boolean(objects.snapshots[targetConnectionId]?.tables[db]?.find((value) => value.name === table)?.type.includes('VIEW'))
      })
      return
    }
    if (action === 'dump' || action === 'dump-data') {
      void dataExport.start(target, db, action === 'dump-data', table)
      return
    }
    if (action === 'refresh') {
      try {
        await refreshObjectTarget(targetConnectionId, db)
      } catch (reason) {
        setOperationError(reason instanceof Error ? reason.message : t('刷新失败'))
      }
      return
    }
    const adapter = getDatabaseAdapter(target.type)
    if (action === 'new') {
      addTab(adapter.tableDataSQL(db, table, { preview: false }), scope)
      return
    }
    if (action !== 'data' && action !== 'structure' && action !== 'ddl') return
    const title = `${adapter.tableLabel(table)} · ${t(action === 'data' ? '数据' : action === 'ddl' ? 'DDL' : '结构')}`
    const tabId = reuseTabId || createPage(action, scope, title, '', discard)
    if (action === 'data') {
      void executeSQL(adapter.tableDataSQL(db, table), scope, tabId, 'data')
      return
    }
    const source = `${target.name} / ${db} / ${adapter.tableLabel(table)}`
    const controller = startRun(tabId, { kind: action, title, source })
    try {
      const structure = await objects.loadStructure(db, table, targetConnectionId)
      if (controller.signal.aborted) throw new Error(t('请求已取消'))
      const rows = action === 'ddl' ? [[structure.ddl]] : structure.columns.map((field) => [field.name, field.type, field.nullable, field.key, field.default, field.extra, field.comment])
      publishResult(tabId, {
        kind: action,
        title,
        source,
        result: {
          columns: (action === 'ddl' ? ['DDL'] : ['字段名', '类型', '允许 NULL', '索引', '默认值', '额外属性', '注释']).map((name) => ({ name, type: '' })),
          rows,
          rowCount: rows.length,
          affectedRows: 0,
          lastInsertId: '',
          durationMs: 0,
          truncated: false,
          isQuery: true
        }
      })
    } catch (error) {
      publishResult(tabId, { kind: action, title, source, error: controller.signal.aborted ? t('请求已取消') : error instanceof Error ? error.message : t('结构加载失败') })
    } finally {
      finishRun(controller)
    }
  }
  const executeSQL = useQueryExecution({
    connections: savedConnections,
    objects,
    running,
    request,
    message: { info: (content) => message.info(typeof content === 'string' ? t(content) : content), error: setOperationError },
    startRun,
    finishRun,
    publishResult,
    setTabs,
    setResultViews,
    appendHistory
  })
  const refreshScope = tab.kind === 'query' ? batch?.scope : tab
  const replayConnection = savedConnections.find((item) => item.id === refreshScope?.connectionId)
  const replayAdapter = replayConnection && replayConnection.type !== DatabaseEngine.Redis ? getDatabaseAdapter(replayConnection.type) : undefined
  const replayRequiresSession = tab.kind === 'query' && Boolean(replayAdapter?.batchStatementRequiresSession) && (batch?.statementCount ?? batch?.statements?.length ?? 0) > 1
  const canRefreshResult = Boolean(
    run && refreshScope && objects.snapshots[refreshScope.connectionId]?.status === 'connected' && (tab.kind !== 'query' || (statementRun?.sql && !replayRequiresSession))
  )
  async function refreshResult() {
    if (running || !canRefreshResult || !refreshScope) return
    if (tab.kind === 'query') {
      if (statementRun?.sql)
        void executeSQL(
          statementRun.sql,
          { ...refreshScope, database: statementRun.database ?? refreshScope.database, schema: statementRun.schema ?? refreshScope.schema },
          tab.id,
          'query',
          statementRun.singleStatement
        )
      return
    }
    if (tab.kind === 'data') {
      void executeSQL(getDatabaseAdapter(connection?.type).tableDataSQL(tab.database, tab.table), tab, tab.id, 'data')
      return
    }
    if (tab.kind === 'ddl' || (tab.kind === 'structure' && tab.table)) void tableAction(tab.kind, tab.connectionId, tab.database, tab.table, tab.id)
    else if (tab.kind === 'structure') void databaseAction('tables', tab.connectionId, tab.database, tab.id, tab.schema, true)
  }
  function executeCurrentSQL(statement: string, singleStatement = false) {
    if (!tab.id || tab.kind !== 'query' || activeTabRef.current !== tab.id || !storage.pageReady) return
    if ((!connection && !redisConnection) || !objects.connected) {
      message.info(t('请先展开连接并加载数据库结构'))
      return
    }
    if (running || request.current) return
    void executeSQL(statement, { connectionId, database: redisDatabase ?? database, schema: selectedSchema, table: selectedTable }, tab.id, 'query', singleStatement)
  }
  function getSelectedSQL() {
    const state = editor.current?.state
    const selection = state?.selection.main
    return state && selection && !selection.empty ? state.sliceDoc(selection.from, selection.to) : null
  }
  function runSelectedSQL(statement: string, mode: 'normal' | 'single' | 'insertTransaction' = 'normal') {
    // 菜单使用打开时的选区快照，避免菜单拿走焦点后误执行整个草稿。
    editorSession.flush()
    if (!statement.trim()) return
    if (mode === 'normal') {
      executeCurrentSQL(statement)
      return
    }
    if (connection?.type !== DatabaseEngine.MySQL && connection?.type !== DatabaseEngine.MariaDB) return
    if (mode === 'single') {
      executeCurrentSQL(statement, true)
      return
    }
    try {
      const statements = adapter.splitStatements(statement)
      if (statements.length < 2 || statements.some((sql) => !/^INSERT\b/i.test(sql))) {
        setOperationError(t('请选择至少两条以 INSERT 开头的语句'))
        return
      }
      const inserts = statements.map((sql) => (sql.endsWith(';') ? sql : sql + '\n;'))
      executeCurrentSQL(['START TRANSACTION;', ...inserts, 'COMMIT;'].join('\n'))
    } catch (error) {
      setOperationError(t(error instanceof Error ? error.message : 'SQL 解析失败'))
    }
  }
  function runSQL() {
    const sql = getSelectedSQL()
    const draft = getCurrentSQL()
    executeCurrentSQL(sql ?? draft)
  }
  function deleteConnection(id: string) {
    const target = savedConnections.find((item) => item.id === id)
    if (!target || running) return
    modal.confirm({
      title: t('删除连接「{value1}」？', { value1: target.name }),
      content: t('删除本机保存的连接信息，数据库中的数据不受影响。'),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!(await closeScope(id))) return
        await removeConnection(id)
        clearHistory(id)
        await loadConnections()
      }
    })
  }
  function closeTabs(key: string, mode: 'current' | 'others' | 'right' = 'current') {
    if (tabBusy || request.current) return
    const index = tabs.findIndex((item) => item.id === key)
    if (index < 0) return
    const remaining = tabs.filter((item, position) => (mode === 'others' ? item.id === key : mode === 'right' ? position <= index : item.id !== key))
    const retained = new Set(remaining.map((page) => page.id))
    const removed = new Set(tabs.filter((page) => !retained.has(page.id)).map((page) => page.id))
    const complete = () => {
      if (request.current) return
      removePages(removed, remaining[Math.min(index, remaining.length - 1)]?.id || '')
    }
    const unsaved = tabs.filter((page) => removed.has(page.id) && designerDirty[page.id])
    if (unsaved.length)
      modal.confirm({
        title: t('关闭有未保存修改的页面？'),
        content: unsaved.map((page) => page.title).join('、') + t(' 的修改将被放弃。'),
        okText: t('放弃并关闭'),
        cancelText: t('继续编辑'),
        onOk: complete
      })
    else complete()
  }

  const closeTab = (key: string) => closeTabs(key)
  const onEditorReady = (view: EditorView) => editorSession.attach(activeTabRef.current, view)
  const onEditorDispose = editorSession.detach
  const getEditorHistory = editorSession.history
  const rememberEditor = editorSession.remember
  const onEditorUpdate = editorSession.update
  const onConnectionSaved = (saved: Connection) => {
    setConnectionModal(false)
    setSavedGroups((previous) => [...new Set([...previous, connectionGroupName(saved.group)])])
    setConnections((previous) => upsertConnection(previous, saved))
    if (editing) {
      setExplorer((previous) => ({
        ...previous,
        expanded: previous.expanded.filter((key) => {
          const [type, owner] = JSON.parse(key) as string[]
          return type === 'group' || owner !== saved.id
        })
      }))
      void objects.closeConnection(saved.id).catch((error) => setOperationError(error instanceof Error ? error.message : t('关闭旧连接失败')))
      setTabs((previous) => previous.map((item) => (item.kind === 'query' && item.connectionId === saved.id ? { ...item, database: '', schema: '', table: '' } : item)))
      if (connectionId === saved.id) resetStructure()
    }
    setEditing(undefined)
  }
  useDesktopExit({
    ready: storage.ready,
    blocked: uiBlocked || connectionLoading || connectionGroups.saving || closingScope.current,
    connectionError,
    snapshot,
    connections: savedConnections,
    dirty: designerDirty,
    pageReady: storage.pageReady,
    pageLoadFailed: storage.pageLoadFailed,
    flushEditor: () => {
      editorSession.remember()
      editorSession.flush()
    },
    draftsFor: storage.draftsFor,
    activatePage: (id) => selectTab(id, true),
    setPreparing: (preparing) => {
      storage.setAutoSavePaused(preparing)
      setDesktopPreparing(preparing)
    },
    setClosing: (closing) => {
      storage.setAutoSavePaused(closing)
      setDesktopClosing(closing)
    },
    stop: () => {
      request.current?.abort()
      dataExport.cancel()
      setRestoringConnections(null)
    },
    running: () => Boolean(request.current),
    persist: storage.flush,
    closeConnection: objects.closeConnection,
    applyWorkspace: (next) => {
      const retained = new Set(next.tabs.map((page) => page.id))
      const removed = new Set(tabs.filter((page) => !retained.has(page.id)).map((page) => page.id))
      const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => retained.has(id)))
      for (const id of removed) {
        closedPages.current.add(id)
        discardTerminal(id)
        pendingDrafts.current.delete(id)
      }
      editorSession.discard(removed)
      setTabs(next.tabs)
      setActiveTab(next.activeTab)
      activeTabRef.current = next.activeTab
      setRuns(next.runs)
      setResultViews(next.resultViews)
      setEditorLayouts(next.editorLayouts)
      setExplorer(next.explorer)
      setDesignerDirty(keep)
      setDesignerBusy(keep)
      const page = next.tabs.find((page) => page.id === next.activeTab)
      resetStructure(page?.kind === 'query' && Boolean(page.table))
      setHistoryOpen(false)
    }
  })
  return {
    desktopClosing,
    desktopPreparing,
    connectionGroups,
    dataExport,
    workspaceReady,
    pageReady: storage.pageReady,
    pageLoadFailed: storage.pageLoadFailed,
    retryPage: storage.retryPage,
    operationError,
    clearOperationError: () => setOperationError(''),
    saving,
    explorer,
    updateExplorer,
    resultHeight,
    setResultHeight,
    sidebarWidth,
    setSidebarWidth,
    tabs,
    activeTab,
    tab,
    runs,
    resultViews,
    running,
    queryRunning,
    uiBlocked: tabsBlocked,
    tabBusy,
    runningTabId,
    activeRunning,
    selectTab,
    addTab,
    closeTab,
    closeTabs,
    designerDirty,
    setTableDesignerBusy,
    replaceTableResult,
    refreshResult,
    canRefreshResult,
    replayRequiresSession,
    setTableDesignerDirty,
    tableDesignerCommitted,
    isTableDesignerBlocked,
    onObjectChanged,
    objectManagement,
    tableAction,
    databaseAction,
    openExplorerPage,
    newQuery,
    openRedisQuery,
    selectRedisDatabase,
    connectionAction,
    openConnection,
    connections,
    savedConnections,
    connectionId,
    connectionLoading,
    connectionError,
    connection,
    engine,
    connectionModal,
    editing,
    loadConnections,
    selectConnection,
    deleteConnection,
    setConnectionModal,
    setEditing,
    updateSQL,
    exportCurrentSQL,
    getCurrentSQL,
    runSQL,
    getSelectedSQL,
    runSelectedSQL,
    updateTab,
    editor,
    objects,
    selectObject,
    columns,
    ddl,
    structureError,
    structureLoading,
    run,
    result,
    resultIndex,
    resultSetIndex,
    selectResult,
    resultSearch,
    setResultSearch,
    history,
    appendHistory,
    clearHistory,
    openHistory,
    loadHistory,
    historyOpen,
    setHistoryOpen,
    historySearch,
    setHistorySearch,
    database,
    selectedTable,
    refresh,
    refreshSchema,
    cancelQuery,
    onEditorReady,
    onEditorDispose,
    getEditorHistory,
    onEditorUpdate,
    rememberEditor,
    onConnectionSaved
  }
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>
