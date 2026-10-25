import type { EditorView, ViewUpdate } from '@codemirror/view'
import { App as AntApp } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { connectionGroupName, databaseTypeInfo } from '@/constant/database'
import { executeQuery, getConnections, deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection } from '@/typings/database'
import type { EditorLayout, ExplorerLayout, HistoryItem, QueryScope, ResultView, RunState, StatementRun, WorkspacePageKind, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { exportSQL, identifier, splitSQLStatements, stripHistoryMarkers } from '@/utils/sql'

import { useDatabaseObjects } from '../useDatabaseObjects'
import { useQueryHistory } from '../useQueryHistory'
import { useWorkspacePersistence } from '../useWorkspacePersistence'

const emptyScope: QueryScope = { connectionId: '', database: '', table: '' }
const emptyTab: WorkspaceTab = { ...emptyScope, id: '', title: '', kind: 'query', sql: '' }

/** 每个主标签就是一个页面；SQL 和结果属于该页面，树操作始终携带独立目标。 */
export const useWorkspace = () => {
  const { message, modal } = AntApp.useApp()
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [connectionModal, setConnectionModal] = useState(false)
  const [editing, setEditing] = useState<Connection>()
  const [tabs, setTabs] = useState<WorkspaceTab[]>([])
  const [activeTab, setActiveTab] = useState('')
  const activeTabRef = useRef('')
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  const [resultViews, setResultViews] = useState<Record<string, ResultView>>({})
  const [editorLayouts, setEditorLayouts] = useState<Record<string, EditorLayout>>({})
  const [explorer, setExplorer] = useState<ExplorerLayout>({ expanded: [], selected: [], search: '', top: 0 })
  const [resultHeight, setResultHeight] = useState(260)
  const [sidebarWidth, setSidebarWidth] = useState(272)
  const [restoringConnections, setRestoringConnections] = useState<string[] | null>(null)
  const [runningTabId, setRunningTabId] = useState('')
  const running = Boolean(runningTabId)
  const activeRunning = Boolean(runningTabId && runningTabId === activeTab)
  const [columns, setColumns] = useState<Column[]>([])
  const [ddl, setDDL] = useState('')
  const [structureError, setStructureError] = useState('')
  const [structureLoading, setStructureLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const editor = useRef<EditorView | null>(null)
  const request = useRef<AbortController | null>(null)
  const executeRef = useRef<() => void>(() => {})
  const tab = tabs.find((item) => item.id === activeTab) || emptyTab
  const { connectionId, database, table: selectedTable } = tab
  const connection = connections.find((item) => item.id === connectionId)
  const engine = databaseTypeInfo(connection?.type)
  const historyStore = useQueryHistory(tab.kind === 'query' ? connectionId : '')
  const { history, appendHistory, clearHistory } = historyStore
  const validateDatabases = useCallback((id: string, databases: string[]) => {
    setTabs((previous) =>
      previous.map((item) => (item.kind === 'query' && item.connectionId === id && item.database && !databases.includes(item.database) ? { ...item, database: '', table: '' } : item))
    )
  }, [])
  const objects = useDatabaseObjects(connectionId, database, validateDatabases)
  const { loadStructure, loadTables, openConnection: openObjectsConnection } = objects
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
  const openedKey = JSON.stringify(Object.keys(objects.snapshots).sort())
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
  const storage = useWorkspacePersistence(snapshot, (saved) => {
    const restoredRuns = { ...saved.runs }
    if (saved.runningTabId && restoredRuns[saved.runningTabId]) {
      const interrupted = restoredRuns[saved.runningTabId]
      restoredRuns[saved.runningTabId] = { ...interrupted, interrupted: true, error: interrupted.result ? interrupted.error : '页面刷新中断了上次执行，请手动重新运行。' }
    }
    setTabs(saved.tabs)
    const active = saved.tabs.some((item) => item.id === saved.activeTab) ? saved.activeTab : saved.tabs[0]?.id || ''
    setActiveTab(active)
    activeTabRef.current = active
    setRuns(restoredRuns)
    setResultViews(saved.resultViews)
    setEditorLayouts(saved.editorLayouts)
    setExplorer(saved.explorer)
    setResultHeight(Number.isFinite(saved.resultHeight) ? Math.max(180, saved.resultHeight) : 260)
    setSidebarWidth(typeof saved.sidebarWidth === 'number' && Number.isFinite(saved.sidebarWidth) ? saved.sidebarWidth : 272)
    setRestoringConnections(saved.openedConnections)
  })
  const workspaceReady = storage.ready && historyStore.ready
  const storageError = storage.error || historyStore.error
  const saving = storage.saving || historyStore.saving
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
            const databases = explorer.expanded.map((key) => JSON.parse(key) as string[]).filter(([type, owner]) => type === 'database' && owner === id)
            await Promise.allSettled(databases.map(([, , db]) => loadTables(db, id)))
          })
          .catch(() => {})
      }
      setTabs((previous) => previous.map((item) => (item.kind === 'query' && !connections.some((connection) => connection.id === item.connectionId) ? { ...item, ...emptyScope } : item)))
    })
    return () => {
      stale = true
    }
  }, [storage.ready, connectionLoading, connectionError, restoringConnections, connections, openObjectsConnection, loadTables, explorer.expanded])

  function updateExplorer(patch: Partial<ExplorerLayout>) {
    setExplorer((previous) => ({ ...previous, ...patch }))
  }

  const applyConnections = useCallback((data: Connection[]) => {
    setConnections(data)
    setTabs((previous) => previous.map((item) => (item.kind !== 'query' || data.some((value) => value.id === item.connectionId) ? item : { ...item, ...emptyScope })))
  }, [])
  const loadConnections = useCallback(async () => {
    setConnectionLoading(true)
    setConnectionError('')
    try {
      applyConnections(await getConnections())
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : '连接列表加载失败')
    } finally {
      setConnectionLoading(false)
    }
  }, [applyConnections])
  useEffect(() => {
    const controller = new AbortController()
    getConnections(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) applyConnections(data)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setConnectionError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setConnectionLoading(false)
      })
    return () => controller.abort()
  }, [applyConnections])
  useEffect(() => () => request.current?.abort(), [])
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
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        executeRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
    if (!tab.id || tab.kind !== 'query') return
    setTabs((previous) => previous.map((item) => (item.id === activeTab ? { ...item, ...patch } : item)))
  }
  const updateSQL = (sql: string) => updateTab({ sql })
  function exportCurrentSQL() {
    if (!tab.sql.trim()) return
    try {
      exportSQL(tab.sql, tab.title)
    } catch {
      message.error('SQL 导出失败，请重试')
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
    const insert = `${current.trim() ? (current.endsWith('\n') ? '\n' : '\n\n') : ''}-- 历史记录\n${stripHistoryMarkers(item.sql)}`
    if (view) {
      view.dispatch({ changes: { from: current.length, insert }, selection: { anchor: current.length + insert.length }, scrollIntoView: true })
      requestAnimationFrame(() => view.focus())
    } else updateSQL(current + insert)
    setHistoryOpen(false)
  }
  function selectTab(id: string) {
    const next = tabs.find((item) => item.id === id)
    activeTabRef.current = id
    editor.current = null
    setActiveTab(id)
    resetStructure(next?.kind === 'query' && Boolean(next.table))
    setHistoryOpen(false)
    setHistorySearch('')
  }
  function createPage(kind: WorkspacePageKind, scope: QueryScope, title: string, sql = '') {
    const added: WorkspaceTab = { ...scope, id: crypto.randomUUID(), kind, title, sql }
    setTabs((previous) => [...previous, added])
    selectTab(added.id)
    return added.id
  }
  function addTab(statement = '', scope?: QueryScope, title?: string) {
    if (running || request.current) return
    return createPage('query', scope || { connectionId, database, table: selectedTable }, title || `查询 ${tabs.filter((item) => item.kind === 'query').length + 1}`, statement)
  }
  function publishResult(id: string, value: RunState) {
    setRuns((previous) => ({ ...previous, [id]: { ...value, id: crypto.randomUUID() } }))
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
  function selectConnection(id: string) {
    if (running || objects.snapshots[id]?.status !== 'connected') return
    updateTab({ connectionId: id, database: '', table: '' })
    resetStructure()
  }
  function selectObject(db: string, table?: string, id = connectionId) {
    if (running || objects.snapshots[id]?.status !== 'connected') return
    if (id !== connectionId || db !== database || (table || '') !== selectedTable) resetStructure(Boolean(table))
    updateTab({ connectionId: id, database: db, table: table || '' })
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
  function closeConnection(id: string) {
    if (running) return
    objects.closeConnection(id)
    // 结果页保留不可变来源；仅清理可执行 SQL 页的失效范围。
    setTabs((previous) => previous.map((item) => (item.kind === 'query' && item.connectionId === id ? { ...item, ...emptyScope } : item)))
    if (id === connectionId) {
      resetStructure()
      setHistoryOpen(false)
    }
  }
  function connectionAction(action: string, id: string) {
    if (running) return
    const target = connections.find((item) => item.id === id)
    if (!target) return
    if (action === 'open') void openConnection(id).catch(() => {})
    else if (action === 'close') closeConnection(id)
    else if (action === 'refresh') refreshSchema(id)
    else if (action === 'edit') {
      setEditing(target)
      setConnectionModal(true)
    } else if (action === 'delete') deleteConnection(id)
  }
  async function databaseAction(action: string, id: string, db: string) {
    if (running || request.current || objects.snapshots[id]?.status !== 'connected') return
    const scope = { connectionId: id, database: db, table: '' }
    if (action === 'new') {
      addTab('', scope)
      return
    }
    if (action === 'refresh') {
      refreshSchema(id)
      return
    }
    if (action !== 'tables') return
    const title = `${db} · 结构`
    const tabId = createPage('structure', scope, title)
    const source = `${connections.find((item) => item.id === id)?.name || ''} / ${db}`
    const controller = startRun(tabId, { kind: 'structure', title, source })
    try {
      const tables = await objects.loadTables(db, id)
      if (controller.signal.aborted) throw new Error('请求已取消')
      publishResult(tabId, {
        kind: 'structure',
        title,
        source,
        result: {
          columns: ['表名', '类型', '注释'].map((name) => ({ name, type: '' })),
          rows: tables.map((table) => [table.name, table.type, table.comment]),
          rowCount: tables.length,
          affectedRows: 0,
          lastInsertId: '',
          durationMs: 0,
          truncated: false,
          isQuery: true
        }
      })
    } catch (error) {
      publishResult(tabId, { kind: 'structure', title, source, error: error instanceof Error ? error.message : '数据库结构加载失败' })
    } finally {
      finishRun(controller)
    }
  }
  async function tableAction(action: string, targetConnectionId: string, db: string, table: string) {
    const target = connections.find((item) => item.id === targetConnectionId)
    if (running || request.current || !target || objects.snapshots[targetConnectionId]?.status !== 'connected') return
    const scope = { connectionId: targetConnectionId, database: db, table }
    const statement = `SELECT * FROM ${identifier(db)}.${identifier(table)} LIMIT 1000;`
    if (action === 'new') {
      addTab(statement, scope)
      return
    }
    if (action !== 'data' && action !== 'structure' && action !== 'ddl') return
    const title = `${table} · ${action === 'data' ? '数据' : action === 'ddl' ? 'DDL' : '结构'}`
    const tabId = createPage(action, scope, title)
    if (action === 'data') {
      void executeSQL(statement, scope, tabId, 'data')
      return
    }
    const source = `${target.name} / ${db} / ${table}`
    const controller = startRun(tabId, { kind: action, title, source })
    try {
      const structure = await objects.loadStructure(db, table, targetConnectionId)
      if (controller.signal.aborted) throw new Error('请求已取消')
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
      publishResult(tabId, { kind: action, title, source, error: controller.signal.aborted ? '请求已取消' : error instanceof Error ? error.message : '结构加载失败' })
    } finally {
      finishRun(controller)
    }
  }
  async function executeSQL(statement: string, scope: QueryScope, tabId: string, kind: WorkspacePageKind = 'query') {
    const target = connections.find((item) => item.id === scope.connectionId)
    if (!target || objects.snapshots[target.id]?.status !== 'connected' || running || request.current) return
    let statements: string[]
    try {
      statements = splitSQLStatements(statement)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'SQL 解析失败')
      return
    }
    if (!statements.length) {
      message.info('请先输入 SQL 语句')
      return
    }
    const source = `${target.name} / ${scope.database || '未选择数据库'}`
    const title = kind === 'data' ? `${scope.table} · 数据` : 'SQL 结果'
    const controller = startRun(tabId, { source, kind, title, statementCount: statements.length })
    const completed: StatementRun[] = []
    try {
      // 驱动继续保持单语句；整批固定目标范围、取消信号和运行锁，逐条保留结果与历史。
      for (const [index, sql] of statements.entries()) {
        const start = performance.now()
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          sql,
          database: scope.database,
          connectionId: target.id,
          connectionName: target.name,
          time: new Date().toISOString(),
          durationMs: 0,
          ok: false
        }
        const entry: StatementRun = { sql }
        try {
          if (controller.signal.aborted) throw new Error('请求已取消')
          entry.result = await executeQuery(target.id, { database: scope.database, sql }, controller.signal)
          if (controller.signal.aborted) throw new Error('请求已取消')
          item.ok = true
          item.durationMs = entry.result.durationMs
          if (!entry.result.isQuery) message.success(`执行成功，影响 ${entry.result.affectedRows} 行`)
        } catch (error) {
          entry.result = undefined
          const reason = controller.signal.aborted ? '请求已取消。' : error instanceof Error ? error.message : '查询失败'
          const remaining = statements.length - index - 1
          entry.error = `${reason}${remaining ? `\n后续 ${remaining} 条语句未执行。` : ''}`
          item.error = reason
          item.durationMs = Math.round(performance.now() - start)
        }
        completed.push(entry)
        appendHistory(item)
        publishResult(tabId, { kind, result: entry.result, error: entry.error, source, title, statements: [...completed], statementCount: statements.length })
        setResultViews((previous) => ({ ...previous, [tabId]: { search: '', page: 1, resultIndex: index } }))
        if (entry.error) break
      }
    } finally {
      finishRun(controller)
    }
  }
  function executeCurrentSQL(statement: string) {
    if (!tab.id || tab.kind !== 'query' || activeTabRef.current !== tab.id) return
    if (!connection || !objects.connected) {
      message.info('请先展开连接并加载数据库结构')
      return
    }
    if (running || request.current) return
    void executeSQL(statement, { connectionId, database, table: selectedTable }, tab.id)
  }
  function getSelectedSQL() {
    const state = editor.current?.state
    const selection = state?.selection.main
    return state && selection && !selection.empty ? state.sliceDoc(selection.from, selection.to) : null
  }
  function runSelectedSQL(statement: string) {
    // 菜单使用打开时的选区快照，避免菜单拿走焦点后误执行整个草稿。
    if (statement.trim()) executeCurrentSQL(statement)
  }
  function runSQL() {
    executeCurrentSQL(getSelectedSQL() ?? tab.sql)
  }
  useEffect(() => {
    executeRef.current = runSQL
  })
  function deleteConnection(id: string) {
    const target = connections.find((item) => item.id === id)
    if (!target || running) return
    modal.confirm({
      title: `删除连接「${target.name}」？`,
      content: '删除本机保存的连接信息，数据库中的数据不受影响。',
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeConnection(id)
        closeConnection(id)
        await loadConnections()
      }
    })
  }
  function closeTabs(key: string, mode: 'current' | 'others' | 'right' = 'current') {
    if (running || request.current) return
    const index = tabs.findIndex((item) => item.id === key)
    if (index < 0) return
    const remaining = tabs.filter((item, position) => (mode === 'others' ? item.id === key : mode === 'right' ? position <= index : item.id !== key))
    const retained = new Set(remaining.map((item) => item.id))
    const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => retained.has(id)))
    setTabs(remaining)
    setRuns(keep)
    setResultViews(keep)
    setEditorLayouts(keep)
    if (!retained.has(activeTab)) selectTab(remaining[Math.min(index, remaining.length - 1)]?.id || '')
  }
  const closeTab = (key: string) => closeTabs(key)
  const cancelQuery = () => request.current?.abort()
  const onEditorReady = (view: EditorView) => {
    editor.current = view
    const saved = editorLayouts[activeTab]
    if (saved) {
      const length = view.state.doc.length
      view.dispatch({ selection: { anchor: Math.min(saved.anchor, length), head: Math.min(saved.head, length) } })
      requestAnimationFrame(() => {
        view.scrollDOM.scrollTop = saved.top
        view.scrollDOM.scrollLeft = saved.left
      })
    }
  }
  function rememberEditor() {
    const view = editor.current
    const id = activeTabRef.current
    if (!view || !id) return
    const { anchor, head } = view.state.selection.main
    const next = { anchor, head, top: view.scrollDOM.scrollTop, left: view.scrollDOM.scrollLeft }
    setEditorLayouts((previous) => {
      const saved = previous[id]
      return saved && Object.keys(next).every((key) => saved[key as keyof EditorLayout] === next[key as keyof EditorLayout]) ? previous : { ...previous, [id]: next }
    })
  }
  function onEditorUpdate(update: ViewUpdate) {
    if (update.view === editor.current && (update.selectionSet || update.docChanged)) rememberEditor()
  }
  const onConnectionSaved = (saved: Connection) => {
    setConnectionModal(false)
    const key = JSON.stringify(['group', connectionGroupName(saved.group)])
    setExplorer((previous) => ({ ...previous, expanded: [...new Set([...previous.expanded, key])] }))
    objects.closeConnection(saved.id)
    setTabs((previous) =>
      previous.map((item) => (item.kind === 'query' && (item.connectionId === saved.id || (!editing && item.id === activeTab)) ? { ...item, connectionId: saved.id, database: '', table: '' } : item))
    )
    if (connectionId === saved.id || !editing) resetStructure()
    void loadConnections()
  }
  return {
    workspaceReady,
    storageError,
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
    runningTabId,
    activeRunning,
    selectTab,
    addTab,
    closeTab,
    closeTabs,
    tableAction,
    databaseAction,
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
    onEditorUpdate,
    rememberEditor,
    onConnectionSaved
  }
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>
