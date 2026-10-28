import type { EditorView, ViewUpdate } from '@codemirror/view'
import { App as AntApp, Button } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { ObjectChange } from '@/databases/typings/objectManagement'
import { executeQuery, getConnections, deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection, QueryResult } from '@/typings/database'
import type { EditorLayout, ExplorerLayout, HistoryItem, QueryScope, ResultView, RunState, StatementRun, WorkspacePageKind, WorkspaceSnapshot, WorkspaceTab } from '@/typings/workspace'
import { exportSQL } from '@/utils/sqlExport'
import { saveSQL } from '@/utils/sqlSave'

import { resultPanelLayout, scopeCloseDialogLayout, sidebarLayout } from '../../constant/layout'
import { buildExplorerTree, explorerQueryScope } from '../../utils/explorerTree'
import { presentObjectPage, presentTableList } from '../../utils/objectPresentation'
import { pagesForScope, sqlForPages } from '../../utils/scopeClose'
import { explorerAfterChange, findExplorerPage, pagesAfterSchemaChange, queryScopesAfterChange, upsertConnection } from '../../utils/workspaceTransitions'
import { useDatabaseObjects } from '../useDatabaseObjects'
import { useObjectManagement } from '../useObjectManagement'
import { useQueryHistory } from '../useQueryHistory'
import { useWorkspacePersistence } from '../useWorkspacePersistence'

const emptyScope: QueryScope = { connectionId: '', database: '', schema: '', table: '' }
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
  const [resultHeight, setResultHeight] = useState<number>(resultPanelLayout.defaultHeight)
  const [sidebarWidth, setSidebarWidth] = useState<number>(sidebarLayout.defaultWidth)
  const [restoringConnections, setRestoringConnections] = useState<string[] | null>(null)
  const [runningTabId, setRunningTabId] = useState('')
  const [objectBusy, setObjectBusy] = useState(false)
  const [designerBusy, setDesignerBusy] = useState<Record<string, boolean>>({})
  const [designerDirty, setDesignerDirty] = useState<Record<string, boolean>>({})
  const activeRunning = Boolean(runningTabId && runningTabId === activeTab)
  const [columns, setColumns] = useState<Column[]>([])
  const [ddl, setDDL] = useState('')
  const [structureError, setStructureError] = useState('')
  const [structureLoading, setStructureLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const editor = useRef<EditorView | null>(null)
  const request = useRef<AbortController | null>(null)
  const closingScope = useRef(false)
  const closedPages = useRef(new Set<string>())
  const executeRef = useRef<() => void>(() => {})
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
  const validateDatabases = useCallback((id: string, databases: string[]) => {
    setTabs((previous) =>
      previous.map((item) => (item.kind === 'query' && item.connectionId === id && item.database && !databases.includes(item.database) ? { ...item, database: '', schema: '', table: '' } : item))
    )
  }, [])
  const schemaConnections = useMemo(() => connections.filter((connection) => getDatabaseAdapter(connection.type).explorer).map((connection) => connection.id), [connections])
  const objects = useDatabaseObjects(connectionId, database, validateDatabases, schemaConnections)
  const objectManagement = useObjectManagement({ connections, blocked: Boolean(runningTabId), onBusyChange: setObjectBusy, onChanged: onObjectChanged })
  const running = Boolean(runningTabId) || objectBusy || Boolean(objectManagement.dialog) || Object.values(designerBusy).some(Boolean)
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
      setTabs((previous) => previous.map((page) => (page.id === id ? { ...page, kind: 'table-design', table: change.name, title: change.name + ' · 设计' } : page))),
    []
  )
  function isTableDesignerBlocked(page: WorkspaceTab) {
    return (
      Boolean(runningTabId) ||
      objectBusy ||
      Boolean(objectManagement.dialog) ||
      Object.entries(designerBusy).some(([id, busy]) => id !== page.id && busy) ||
      objects.snapshots[page.connectionId]?.status !== 'connected'
    )
  }
  useEffect(() => {
    if (objectBusy) return
    setTabs((previous) => {
      let changed = false
      const next = previous.map((page) => {
        const names = objects.snapshots[page.connectionId]?.schemas?.[page.database]
        if (page.kind !== 'query' || !page.schema || !names || names.includes(page.schema)) return page
        changed = true
        return { ...page, schema: '', table: '' }
      })
      return changed ? next : previous
    })
  }, [objects.snapshots, objectBusy])
  const { loadStructure, loadTables, loadTableDetails, openConnection: openObjectsConnection } = objects
  useEffect(() => {
    if (tab.kind === 'query' && objects.connected && database) void loadTables(database, connectionId).catch(() => {})
  }, [tab.kind, objects.connected, database, connectionId, loadTables])
  const resultIndex = resultViews[activeTab]?.resultIndex || 0
  const batch = runs[activeTab]
  const statementRun = batch?.statements?.[resultIndex]
  const run = statementRun ? { ...batch, result: statementRun.result, error: statementRun.error, id: `${batch.id}:${resultIndex}` } : batch
  const result = useMemo(() => (tab.kind === 'structure' && !tab.table ? presentTableList(run?.result, adapter, tab.schema) : run?.result), [run?.result, adapter, tab.kind, tab.table, tab.schema])
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
    setResultHeight(Number.isFinite(saved.resultHeight) ? Math.max(resultPanelLayout.minimumHeight, saved.resultHeight) : resultPanelLayout.defaultHeight)
    setSidebarWidth(typeof saved.sidebarWidth === 'number' && Number.isFinite(saved.sidebarWidth) ? saved.sidebarWidth : sidebarLayout.defaultWidth)
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
  }, [storage.ready, connectionLoading, connectionError, restoringConnections, connections, openObjectsConnection, loadTables, loadTableDetails, explorer.expanded])

  useEffect(() => {
    if (!storage.ready || connectionLoading || connectionError) return
    setTabs((previous) => {
      let changed = false
      const next = previous.map((page) => {
        const owner = connections.find((connection) => connection.id === page.connectionId)
        if (!owner) return page
        const presented = presentObjectPage(page, getDatabaseAdapter(owner.type))
        changed ||= presented !== page
        return presented
      })
      return changed ? next : previous
    })
  }, [storage.ready, connectionLoading, connectionError, connections])

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
    const insert = `${current.trim() ? (current.endsWith('\n') ? '\n' : '\n\n') : ''}-- 历史记录\n${adapter.cleanHistory(item.sql)}`
    if (view) {
      view.dispatch({ changes: { from: current.length, insert }, selection: { anchor: current.length + insert.length }, scrollIntoView: true })
      requestAnimationFrame(() => view.focus())
    } else updateSQL(current + insert)
    setHistoryOpen(false)
  }
  function selectTab(id: string, discard = false) {
    if (id !== activeTab && tab.kind === 'data' && designerDirty[activeTab] && !discard) {
      modal.confirm({ title: '放弃当前表的未保存修改？', okText: '放弃并切换', cancelText: '继续编辑', onOk: () => selectTab(id, true) })
      return
    }
    const next = tabs.find((item) => item.id === id)
    activeTabRef.current = id
    editor.current = null
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
    return createPage('query', scope || emptyScope, title || `查询 ${tabs.filter((item) => item.kind === 'query').length + 1}`, statement)
  }
  function newQuery() {
    const layouts = Object.fromEntries(connections.map((item) => [item.id, getDatabaseAdapter(item.type).explorer]))
    const tree = buildExplorerTree(connections, objects.snapshots, explorer.expanded, explorer.search, layouts)
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
    createPage(kind, scope, kind === 'table-create' ? '新建表 ' + number + ' · ' + scope.database : scope.table + ' · 设计')
  }
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
      if (!engine) throw new Error('无法识别 Schema 所属引擎')
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
      message.info('请等待当前对象操作完成后再关闭')
      return false
    }
    closingScope.current = true
    setObjectBusy(true)
    const affected = pagesForScope(tabs, id, db).map((page) => (page.id === activeTab && page.kind === 'query' && editor.current ? { ...page, sql: editor.current.state.doc.toString() } : page))
    const sql = sqlForPages(affected)
    const dirty = affected.filter((page) => designerDirty[page.id])
    try {
      if (sql || dirty.length) {
        const proceed = await new Promise<boolean>((resolve) => {
          const dialog = modal.confirm({
            width: scopeCloseDialogLayout.width,
            title: sql ? '关闭前是否保存查询？' : '关闭前请确认未保存的修改',
            content: (
              <>
                <p>
                  {affected.map((page) => page.title).join('、')} 将随{db ? '数据库' : '连接'}一起关闭。
                </p>
                {sql && <p>查询内容将保存为一个 .sql 文件。</p>}
                {dirty.length > 0 && <p>{dirty.map((page) => page.title).join('、')} 的表结构或数据修改尚未提交，继续关闭将放弃这些修改；SQL 文件不包含这些修改。</p>}
              </>
            ),
            okText: sql ? '保存并关闭' : '放弃并关闭',
            cancelText: '取消',
            onCancel: () => resolve(false),
            onOk: async () => {
              try {
                if (sql) await saveSQL(sql, db || 'SQL Studio 查询')
                resolve(true)
              } catch (error) {
                if (!(error instanceof DOMException && error.name === 'AbortError')) message.error('SQL 保存失败，窗口已保留')
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
                    不保存
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
      // 只有服务端确认驱动资源已释放后，才删除窗口和本地元数据。
      if (db === undefined) await objects.closeConnection(id)
      else await objects.closeDatabase(id, db)
      const removed = new Set(affected.map((page) => page.id))
      removed.forEach((page) => closedPages.current.add(page))
      const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([key]) => !removed.has(key)))
      const remaining = tabs.filter((page) => !removed.has(page.id))
      setTabs(remaining)
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
      message.error(error instanceof Error ? error.message : '关闭失败，窗口已保留')
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
        message.error(error instanceof Error ? error.message : '打开数据库失败')
      }
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
      if (!adapter.objects && !(objectAction === ObjectAction.CreateTable && adapter.tableDesign && schema) && !adapter.simpleObjects?.actions.includes(objectAction)) return
      if (
        (objectAction === ObjectAction.RenameSchema || objectAction === ObjectAction.DropSchema) &&
        tabs.some((page) => page.connectionId === id && page.database === db && page.schema === schema && (page.kind === 'table-design' || page.kind === 'table-create' || designerDirty[page.id]))
      ) {
        message.info('请先保存或关闭此 Schema 中的表设计及未保存的数据修改')
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
        message.error(reason instanceof Error ? reason.message : '刷新失败')
      }
      return
    }
    if (action !== 'tables') return
    const title = `${db}${schema ? ' / ' + schema : ''} · 结构`
    const tabId = reuseTabId || createPage('structure', scope, title, '', discard)
    const source = `${connections.find((item) => item.id === id)?.name || ''} / ${db}${schema ? ' / ' + schema : ''}`
    const controller = startRun(tabId, { kind: 'structure', title, source })
    try {
      const tables = await (refresh ? objects.refreshTables(db, id, true) : objects.loadTables(db, id))
      const adapter = getDatabaseAdapter(connections.find((connection) => connection.id === id)?.type)
      const listing = adapter.explorer && !schema ? adapter.explorer.schemaListResult(await objects.loadSchemas(db, id)) : adapter.tableListResult(tables, schema)
      if (controller.signal.aborted) throw new Error('请求已取消')
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
      publishResult(tabId, { kind: 'structure', title, source, error: error instanceof Error ? error.message : '数据库结构加载失败' })
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
      modal.confirm({ title: '放弃表格中未保存的修改？', content: '刷新或切换页面会放弃未保存的修改。', okText: '放弃并继续', cancelText: '继续编辑', onOk: open })
    } else open()
  }
  async function tableAction(action: string, targetConnectionId: string, db: string, table: string, reuseTabId?: string, discard = false) {
    const target = connections.find((item) => item.id === targetConnectionId)
    if (running || request.current || !target || objects.snapshots[targetConnectionId]?.status !== 'connected') return
    const scope = {
      connectionId: targetConnectionId,
      database: db,
      schema: getDatabaseAdapter(target.type).explorer?.tableIdentity(table).schema,
      table,
      view: Boolean(objects.snapshots[targetConnectionId]?.tables[db]?.find((value) => value.name === table)?.type.includes('VIEW'))
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
      void objectManagement.open(objectAction, scope)
      return
    }
    if (action === 'dump' || action === 'dump-data') {
      void objectManagement.dump(scope, action === 'dump-data')
      return
    }
    if (action === 'refresh') {
      try {
        await refreshObjectTarget(targetConnectionId, db)
      } catch (reason) {
        message.error(reason instanceof Error ? reason.message : '刷新失败')
      }
      return
    }
    const statement = getDatabaseAdapter(target.type).tableDataSQL(db, table)
    if (action === 'new') {
      addTab(statement, scope)
      return
    }
    if (action !== 'data' && action !== 'structure' && action !== 'ddl') return
    const title = `${getDatabaseAdapter(target.type).tableLabel(table)} · ${action === 'data' ? '数据' : action === 'ddl' ? 'DDL' : '结构'}`
    const tabId = reuseTabId || createPage(action, scope, title, '', discard)
    if (action === 'data') {
      void executeSQL(statement, scope, tabId, 'data')
      return
    }
    const source = `${target.name} / ${db} / ${getDatabaseAdapter(target.type).tableLabel(table)}`
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
      statements = getDatabaseAdapter(target.type).splitStatements(statement)
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'SQL 解析失败')
      return
    }
    if (!statements.length) {
      message.info('请先输入 SQL 语句')
      return
    }
    const source = `${target.name} / ${scope.database || '未选择数据库'}${scope.schema ? ' / ' + scope.schema : ''}`
    const title = kind === 'data' ? `${getDatabaseAdapter(target.type).tableLabel(scope.table)} · 数据` : 'SQL 结果'
    const startedAt = new Date().toISOString()
    const batchStart = performance.now()
    const controller = startRun(tabId, { scope: { ...scope }, source, kind, title, statementCount: statements.length, startedAt, durationMs: 0 })
    const completed: StatementRun[] = []
    let executionDatabase = scope.database
    try {
      // 驱动继续保持单语句；整批固定连接、取消信号和运行锁，默认库跟随成功的 USE，逐条保留结果与历史。
      for (const [index, sql] of statements.entries()) {
        const start = performance.now()
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          sql,
          database: executionDatabase,
          connectionId: target.id,
          connectionName: target.name,
          databaseType: target.type,
          schema: scope.schema,
          time: new Date().toISOString(),
          durationMs: 0,
          ok: false
        }
        const entry: StatementRun = { sql, database: executionDatabase, schema: scope.schema }
        try {
          if (controller.signal.aborted) throw new Error('请求已取消')
          entry.result = await executeQuery(
            target.id,
            { database: executionDatabase, ...(scope.schema ? { schema: scope.schema } : {}), sql, ...(kind === 'query' && target.type === 'postgresql' ? { allowWrite: true } : {}) },
            controller.signal
          )
          if (controller.signal.aborted) throw new Error('请求已取消')
          const selectedDatabase = getDatabaseAdapter(target.type).useDatabase(sql)
          if (selectedDatabase !== undefined) {
            executionDatabase = selectedDatabase
            setTabs((previous) =>
              previous.map((page) => (page.id === tabId && page.kind === 'query' && page.connectionId === target.id ? { ...page, database: selectedDatabase, schema: '', table: '' } : page))
            )
          }
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
        entry.durationMs = item.durationMs
        completed.push(entry)
        appendHistory(item)
        publishResult(tabId, {
          scope: { ...scope },
          kind,
          result: entry.result,
          error: entry.error,
          source,
          title,
          statements: [...completed],
          statementCount: statements.length,
          startedAt,
          endedAt: entry.error || index === statements.length - 1 ? new Date().toISOString() : undefined,
          durationMs: Math.round(performance.now() - batchStart)
        })
        setResultViews((previous) => ({ ...previous, [tabId]: { search: '', page: 1, resultIndex: index } }))
        if (entry.error) break
      }
    } finally {
      finishRun(controller)
    }
  }
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
    if (!tab.id || tab.kind !== 'query' || activeTabRef.current !== tab.id) return
    if (!connection || !objects.connected) {
      message.info('请先展开连接并加载数据库结构')
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
        if (!(await closeScope(id))) return
        await removeConnection(id)
        clearHistory(id)
        await loadConnections()
      }
    })
  }
  function closeTabs(key: string, mode: 'current' | 'others' | 'right' = 'current') {
    if (running || request.current) return
    const index = tabs.findIndex((item) => item.id === key)
    if (index < 0) return
    const remaining = tabs.filter((item, position) => (mode === 'others' ? item.id === key : mode === 'right' ? position <= index : item.id !== key))
    const complete = () => {
      if (request.current) return
      const retained = new Set(remaining.map((item) => item.id))
      const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => retained.has(id)))
      setTabs(remaining)
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
      modal.confirm({ title: '关闭有未保存修改的页面？', content: unsaved.map((page) => page.title).join('、') + ' 的修改将被放弃。', okText: '放弃并关闭', cancelText: '继续编辑', onOk: complete })
    else complete()
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
    setConnections((previous) => upsertConnection(previous, saved))
    if (editing) {
      setExplorer((previous) => ({
        ...previous,
        expanded: previous.expanded.filter((key) => {
          const [type, owner] = JSON.parse(key) as string[]
          return type === 'group' || owner !== saved.id
        })
      }))
      void objects.closeConnection(saved.id).catch((error) => message.error(error instanceof Error ? error.message : '关闭旧连接失败'))
      setTabs((previous) => previous.map((item) => (item.kind === 'query' && item.connectionId === saved.id ? { ...item, database: '', schema: '', table: '' } : item)))
      if (connectionId === saved.id) resetStructure()
    }
    setEditing(undefined)
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
