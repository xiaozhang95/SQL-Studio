import type { EditorView } from '@codemirror/view'
import { App as AntApp, Button } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectionGroupLabel, connectionGroupName, defaultConnectionGroup } from '@/constant/connectionGroup'
import { getDatabaseAdapter } from '@/databases'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { ObjectChange } from '@/databases/typings/objectManagement'
import { useSidebarWidth } from '@/hooks/useSidebarWidth'
import { useTranslation } from '@/hooks/useTranslation'
import { deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection } from '@/typings/database'
import type { EditorLayout, ExplorerLayout, HistoryItem, QueryScope, WorkspacePageKind, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { exportSQL } from '@/utils/sqlExport'
import { saveSQL } from '@/utils/sqlSave'

import { resultPanelLayout, scopeCloseDialogLayout } from '../../constant/layout'
import { buildExplorerTree, explorerQueryScope } from '../../utils/explorerTree'
import { canExportDatabase } from '../../utils/exportAvailability'
import { pagesForScope, sqlForPages } from '../../utils/scopeClose'
import { reconcileWorkspacePages } from '../../utils/workspacePages'
import { explorerAfterChange, explorerAfterDatabasesLoaded, findExplorerPage, pagesAfterSchemaChange, queryScopesAfterChange, upsertConnection } from '../../utils/workspaceTransitions'
import { useConnectionGroups } from '../useConnectionGroups'
import { useDatabaseObjects } from '../useDatabaseObjects'
import { useDataExport } from '../useDataExport'
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
      setTabs((previous) => previous.map((item) => (item.kind !== 'query' || data.some((value) => value.id === item.connectionId) ? item : { ...item, ...emptyScope })))
    },
    [setTabs]
  )
  const { connections, setConnections, setSavedGroups, groups, connectionLoading, connectionError, loadConnections } = useWorkspaceConnections(onConnectionsLoaded)
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
  const adapter = getDatabaseAdapter(connection?.type)
  const engine = adapter.profile
  const historyStore = useQueryHistory(tab.kind === 'query' ? connectionId : '')
  const { history, appendHistory, clearHistory, pruneHistory } = historyStore
  useEffect(() => {
    // 列表失败/尚未恢复时不能把暂时的空列表当成所有连接已删除。
    if (historyStore.ready && !connectionLoading && !connectionError) pruneHistory(connections.map((item) => item.id))
  }, [historyStore.ready, connectionLoading, connectionError, connections, pruneHistory])
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
  const objects = useDatabaseObjects(connectionId, database, validateDatabases, schemaConnections)
  const dataExport = useDataExport((id, db) => canExportDatabase(objects.snapshots[id], objects.closedDatabases[id], db))
  const objectManagement = useObjectManagement({ connections, blocked: Boolean(runningTabId), onBusyChange: setObjectBusy, onChanged: onObjectChanged })
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
    [setTabs]
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
  const { loadStructure, loadTables, loadTableDetails, openConnection: openObjectsConnection } = objects
  useEffect(() => {
    if (tab.kind === 'query' && objects.connected && database) void loadTables(database, connectionId).catch(() => {})
  }, [tab.kind, objects.connected, database, connectionId, loadTables])
  const resultIndex = resultViews[activeTab]?.resultIndex || 0
  const batch = runs[activeTab]
  const statementRun = batch?.statements?.[resultIndex]
  const run = statementRun ? { ...batch, result: statementRun.result, error: statementRun.error, id: `${batch.id}:${resultIndex}` } : batch
  const result = run?.result
  const resultSearch = resultViews[activeTab]?.search || ''
  const tablePage = resultViews[activeTab]?.page || 1
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
      explorer,
      resultHeight,
      sidebarWidth,
      openedConnections: restoringConnections || openedConnections,
      runningTabId
    }),
    [tabs, activeTab, runs, resultViews, editorLayouts, explorer, resultHeight, sidebarWidth, restoringConnections, openedConnections, runningTabId]
  )
  const storage = useWorkspacePersistence(
    snapshot,
    (saved) => {
      setTabs(saved.tabs)
      const active = saved.tabs.some((item) => item.id === saved.activeTab) ? saved.activeTab : saved.tabs[0]?.id || ''
      setActiveTab(active)
      activeTabRef.current = active
      setRuns(saved.runs)
      setResultViews(saved.resultViews)
      setEditorLayouts(saved.editorLayouts)
      const restoredConnectionIds = new Set(saved.openedConnections)
      setExplorer({
        ...saved.explorer,
        expanded: saved.explorer.expanded.filter((key) => {
          const [kind, owner] = JSON.parse(key) as string[]
          return kind === 'group' || restoredConnectionIds.has(owner)
        })
      })
      setResultHeight(Number.isFinite(saved.resultHeight) ? Math.max(resultPanelLayout.minimumHeight, saved.resultHeight) : resultPanelLayout.defaultHeight)
      restoreSidebarWidth(saved.sidebarWidth)
      setRestoringConnections(saved.openedConnections)
    },
    {
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
  const queryRunning = Boolean(runningTabId)
  const uiBlocked = objectBusy || Boolean(objectManagement.dialog) || connectionGroups.saving || Boolean(connectionGroups.dialog) || Object.values(designerBusy).some(Boolean) || connectionModal
  const tabBusy = queryRunning || uiBlocked
  const running = tabBusy || !storage.pageReady
  const workspaceReady = storage.ready && historyStore.ready
  const storageError = storage.error || historyStore.error
  const saving = storage.saving || editorSession.pending || historyStore.saving
  useEffect(() => {
    if (!storage.ready || connectionLoading || connectionError || !restoringConnections) return
    let stale = false
    const ids = restoringConnections.filter((id) => connections.some((connection) => connection.id === id))
    void Promise.resolve().then(() => {
      if (stale) return
      setRestoringConnections(null)
      for (const id of ids) {
        void openObjectsConnection(id)
          .then(async () => {
            const expandedNodes = explorer.expanded.map((key) => JSON.parse(key) as string[])
            const databases = expandedNodes.filter(([type, owner]) => type === 'database' && owner === id)
            await Promise.allSettled(databases.map(([, , db]) => loadTables(db, id)))
            // 只恢复用户已展开表的详情，避免虚拟滚动恢复时字段/索引再插入导致位移。
            const tables = expandedNodes.filter(([type, owner, db]) => type === 'table' && owner === id && databases.some(([, , name]) => name === db))
            await Promise.allSettled(tables.map(([, , db, name]) => loadTableDetails(db, name, id)))
          })
          .catch(() => {})
      }
      setTabs((previous) => previous.map((item) => (item.kind === 'query' && !connections.some((connection) => connection.id === item.connectionId) ? { ...item, ...emptyScope } : item)))
    })
    return () => {
      stale = true
    }
  }, [storage.ready, connectionLoading, connectionError, restoringConnections, connections, openObjectsConnection, loadTables, loadTableDetails, explorer.expanded, setTabs])

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
  useQueryShortcut({ enabled: active && !running && storage.pageReady && !connectionModal && !historyOpen && tab.kind === 'query', editor, run: runSQL })

  function resetStructure(loading = false) {
    setColumns([])
    setDDL('')
    setStructureError('')
    setStructureLoading(loading)
  }
  function setResultSearch(search: string) {
    setResultViews((previous) => ({ ...previous, [activeTab]: { search, page: 1, resultIndex: previous[activeTab]?.resultIndex || 0 } }))
  }
  function setTablePage(page: number) {
    setResultViews((previous) => ({ ...previous, [activeTab]: { search: previous[activeTab]?.search || '', page, resultIndex: previous[activeTab]?.resultIndex || 0 } }))
  }
  function selectResult(index: number) {
    if (activeRunning || !batch?.statements?.[index]) return
    setResultViews((previous) => ({ ...previous, [activeTab]: { search: '', page: 1, resultIndex: index } }))
  }
  function updateTab(patch: Partial<QueryScope> & { sql?: string }) {
    if (!tab.id || tab.kind !== 'query' || !storage.pageReady) return
    setTabs((previous) => previous.map((item) => (item.id === activeTab ? { ...item, ...patch } : item)))
  }
  const updateSQL = (sql: string) => updateTab({ sql })
  function getCurrentSQL() {
    const change = editorSession.flush()
    return change?.id === activeTabRef.current && change.sql !== undefined ? change.sql : editorSession.read(activeTabRef.current, tab.sql)
  }
  function exportCurrentSQL() {
    const sql = getCurrentSQL()
    if (!sql.trim()) return
    try {
      exportSQL(sql, tab.title)
    } catch {
      setOperationError(t('SQL 导出失败，请重试'))
    }
  }
  function openHistory() {
    if (tab.kind !== 'query' || !connection) return
    setHistorySearch('')
    setHistoryOpen(true)
  }
  function loadHistory(item: HistoryItem) {
    if (running || request.current || tab.kind !== 'query' || !tab.id || item.connectionId !== connectionId) return
    const view = editor.current
    const current = view?.state.doc.toString() ?? tab.sql
    // 仅追加到当前 SQL 页，不替换草稿、不改变库范围，也不自动执行历史语句。
    const insert = `${current.trim() ? (current.endsWith('\n') ? '\n' : '\n\n') : ''}-- 历史记录\n${adapter.cleanHistory(item.sql)}`
    if (view) {
      view.dispatch({ changes: { from: current.length, insert }, selection: { anchor: current.length + insert.length }, scrollIntoView: true })
      requestAnimationFrame(() => view.focus())
    } else updateSQL(current + insert)
    setHistoryOpen(false)
  }
  function selectTab(id: string, discard = false) {
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
    const tree = buildExplorerTree(connections, objects.snapshots, explorer.expanded, explorer.search, layouts, connectionGroups.groups, objects.closedDatabases, (group) =>
      connectionGroupLabel(group, t)
    )
    const node = tree.byKey.get(explorer.selected[0])
    const scope = explorerQueryScope(node, Boolean(node && objects.snapshots[node.owner]?.status === 'connected'), node ? layouts[node.owner] : undefined)
    addTab('', scope)
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
    if (running || objects.snapshots[id]?.status !== 'connected') return
    updateTab({ connectionId: id, database: '', schema: '', table: '' })
    resetStructure()
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
    setTabs((previous) => queryScopesAfterChange(previous, change))
    setExplorer((previous) => explorerAfterChange(previous, change))
    if (connectionId === target.connectionId && database === target.database && (!target.table || selectedTable === target.table)) {
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
    editorSession.flush()
    const scoped = pagesForScope(tabs, id, db).map((page) => (page.id === activeTab && page.kind === 'query' && editor.current ? { ...page, sql: editor.current.state.doc.toString() } : page))
    try {
      const affected = await storage.draftsFor(scoped)
      const sql = sqlForPages(affected)
      const dirty = affected.filter((page) => designerDirty[page.id])
      if (sql || dirty.length) {
        const proceed = await new Promise<boolean>((resolve) => {
          const dialog = modal.confirm({
            width: scopeCloseDialogLayout.width,
            title: sql ? t('关闭前是否保存查询？') : t('关闭前请确认未保存的修改'),
            content: (
              <>
                <p>
                  {affected.map((page) => page.title).join('、')} {t(' 将随')}
                  {db ? t('数据库') : t('连接')}
                  {t('一起关闭。')}
                </p>
                {sql && <p>{t('查询内容将保存为一个 .sql 文件。')}</p>}
                {dirty.length > 0 && (
                  <p>
                    {dirty.map((page) => page.title).join('、')} {t(' 的表结构或数据修改尚未提交，继续关闭将放弃这些修改；SQL 文件不包含这些修改。')}
                  </p>
                )}
              </>
            ),
            okText: sql ? t('保存并关闭') : t('放弃并关闭'),
            cancelText: t('取消'),
            onCancel: () => resolve(false),
            onOk: async () => {
              try {
                if (sql) await saveSQL(sql, db || t('SQL Studio 查询'))
                resolve(true)
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
                      resolve(true)
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
        })
        if (!proceed) return false
      }
      const activeScope = runs[runningTabId]?.scope || tabs.find((page) => page.id === runningTabId)
      if (activeScope?.connectionId === id && (db === undefined || activeScope.database === db)) request.current?.abort()
      if (dataExport.busy && dataExport.state?.connectionId === id && (db === undefined || dataExport.state.database === db)) dataExport.cancel()
      // 只有服务端确认驱动资源已释放后，才删除窗口和本地元数据。
      if (db === undefined) await objects.closeConnection(id)
      else await objects.closeDatabase(id, db)
      const removed = new Set(affected.map((page) => page.id))
      removed.forEach((page) => closedPages.current.add(page))
      editorSession.discard(removed)
      const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([key]) => !removed.has(key)))
      const remaining = tabs.filter((page) => !removed.has(page.id))
      setTabs((previous) => previous.filter((page) => !removed.has(page.id)))
      setRuns(keep)
      setResultViews(keep)
      setEditorLayouts(keep)
      setDesignerBusy(keep)
      setDesignerDirty(keep)
      if (removed.has(activeTabRef.current)) selectTab(remaining[0]?.id || '', true)
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
    const target = connections.find((item) => item.id === id)
    if (!target) return
    if (action === 'create-database') void objectManagement.open(ObjectAction.CreateDatabase, { connectionId: id, database: '', table: '' })
    else if (action === 'open') void openConnection(id).catch(() => {})
    else if (action === 'refresh') refreshSchema(id)
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
    const statement = getDatabaseAdapter(target.type).tableDataSQL(db, table)
    if (action === 'new') {
      addTab(statement, scope)
      return
    }
    if (action !== 'data' && action !== 'structure' && action !== 'ddl') return
    const title = `${getDatabaseAdapter(target.type).tableLabel(table)} · ${t(action === 'data' ? '数据' : action === 'ddl' ? 'DDL' : '结构')}`
    const tabId = reuseTabId || createPage(action, scope, title, '', discard)
    if (action === 'data') {
      void executeSQL(statement, scope, tabId, 'data')
      return
    }
    const source = `${target.name} / ${db} / ${getDatabaseAdapter(target.type).tableLabel(table)}`
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
    connections,
    objects,
    running,
    request,
    message: { ...message, error: setOperationError },
    startRun,
    finishRun,
    publishResult,
    setTabs,
    setResultViews,
    appendHistory
  })
  const refreshScope = tab.kind === 'query' ? batch?.scope : tab
  const canRefreshResult = Boolean(run && refreshScope && objects.snapshots[refreshScope.connectionId]?.status === 'connected' && (tab.kind !== 'query' || statementRun?.sql))
  async function refreshResult() {
    if (running || !canRefreshResult || !refreshScope) return
    if (tab.kind === 'query') {
      if (statementRun?.sql)
        void executeSQL(statementRun.sql, { ...refreshScope, database: statementRun.database ?? refreshScope.database, schema: statementRun.schema ?? refreshScope.schema }, tab.id)
      return
    }
    if (tab.kind === 'data') {
      void executeSQL(getDatabaseAdapter(connection?.type).tableDataSQL(tab.database, tab.table), tab, tab.id, 'data')
      return
    }
    if (tab.kind === 'ddl' || (tab.kind === 'structure' && tab.table)) void tableAction(tab.kind, tab.connectionId, tab.database, tab.table, tab.id)
    else if (tab.kind === 'structure') void databaseAction('tables', tab.connectionId, tab.database, tab.id, tab.schema, true)
  }
  function executeCurrentSQL(statement: string) {
    if (!tab.id || tab.kind !== 'query' || activeTabRef.current !== tab.id || !storage.pageReady) return
    if (!connection || !objects.connected) {
      message.info(t('请先展开连接并加载数据库结构'))
      return
    }
    if (running || request.current) return
    void executeSQL(statement, { connectionId, database, schema: selectedSchema, table: selectedTable }, tab.id)
  }
  function getSelectedSQL() {
    const state = editor.current?.state
    const selection = state?.selection.main
    return state && selection && !selection.empty ? state.sliceDoc(selection.from, selection.to) : null
  }
  function runSelectedSQL(statement: string) {
    // 菜单使用打开时的选区快照，避免菜单拿走焦点后误执行整个草稿。
    editorSession.flush()
    if (statement.trim()) executeCurrentSQL(statement)
  }
  function runSQL() {
    const sql = getSelectedSQL()
    const draft = getCurrentSQL()
    executeCurrentSQL(sql ?? draft)
  }
  function deleteConnection(id: string) {
    const target = connections.find((item) => item.id === id)
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
    const complete = () => {
      if (request.current) return
      const retained = new Set(remaining.map((item) => item.id))
      const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => retained.has(id)))
      const removed = new Set(tabs.filter((page) => !retained.has(page.id)).map((page) => page.id))
      removed.forEach((id) => closedPages.current.add(id))
      editorSession.discard(removed)
      setTabs((previous) => previous.filter((page) => retained.has(page.id)))
      setRuns(keep)
      setResultViews(keep)
      setEditorLayouts(keep)
      setDesignerBusy(keep)
      setDesignerDirty(keep)
      if (!retained.has(activeTab)) selectTab(remaining[Math.min(index, remaining.length - 1)]?.id || '', true)
    }
    const retained = new Set(remaining.map((page) => page.id))
    const unsaved = tabs.filter((page) => !retained.has(page.id) && designerDirty[page.id])
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
  return {
    connectionGroups,
    dataExport,
    workspaceReady,
    pageReady: storage.pageReady,
    pageLoadError: storage.loadError,
    retryPage: storage.retryPage,
    storageError,
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
    uiBlocked,
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
    setTableDesignerDirty,
    tableDesignerCommitted,
    isTableDesignerBlocked,
    onObjectChanged,
    objectManagement,
    tableAction,
    databaseAction,
    openExplorerPage,
    newQuery,
    connectionAction,
    openConnection,
    connections,
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
    selectResult,
    resultSearch,
    setResultSearch,
    tablePage,
    setTablePage,
    history,
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
