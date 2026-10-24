import type { EditorView } from '@codemirror/view'
import { App as AntApp } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'

import { databaseTypeInfo } from '@/constant/database'
import { executeQuery, getColumns, getConnections, getDDL, deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection, QueryResult } from '@/typings/database'
import type { HistoryItem, QueryScope, QueryTab } from '@/typings/workspace'
import { exportSQL, identifier } from '@/utils/sql'
import { readLocal, saveLocal } from '@/utils/storage'

import { useDatabaseObjects } from '../useDatabaseObjects'

type RunState = { id?: string; title?: string; kind?: 'query' | 'data' | 'structure' | 'ddl'; result?: QueryResult; error?: string; source: string }
const newTab = (n: number): QueryTab => ({
  id: crypto.randomUUID(),
  title: `查询 ${n}`,
  sql: '',
  connectionId: '',
  database: '',
  table: ''
})

/** 编排连接、查询范围和执行生命周期；查询结果始终归属发起时的标签。 */
export const useWorkspace = () => {
  const { message, modal } = AntApp.useApp()
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionLoading, setConnectionLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [connectionModal, setConnectionModal] = useState(false)
  const [editing, setEditing] = useState<Connection>()
  const [tabs, setTabs] = useState<QueryTab[]>(() => {
    // 旧版草稿缺少范围字段时补齐，不能因升级丢失用户 SQL。
    const saved = readLocal<QueryTab[]>('sqldesk.tabs', [])
    if (!Array.isArray(saved) || !saved.length || !saved.every((t) => t && typeof t.sql === 'string' && typeof t.id === 'string' && t.id && typeof t.title === 'string')) return [newTab(1)]
    return saved.map((t) => ({
      id: t.id,
      title: t.title,
      sql: t.sql,
      connectionId: typeof t.connectionId === 'string' ? t.connectionId : '',
      database: typeof t.database === 'string' ? t.database : '',
      table: typeof t.table === 'string' ? t.table : ''
    }))
  })
  const [activeTab, setActiveTab] = useState(() => {
    const saved = readLocal<string>('sqldesk.activeTab', '')
    return tabs.some((item) => item.id === saved) ? saved : tabs[0].id
  })
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  const [resultSets, setResultSets] = useState<Record<string, RunState[]>>({})
  const [selectedResult, setSelectedResult] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [ddl, setDDL] = useState('')
  const [structureError, setStructureError] = useState('')
  const [structureLoading, setStructureLoading] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const data = readLocal<HistoryItem[]>('sqldesk.history', [])
    return Array.isArray(data) ? data : []
  })
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [resultSearch, setResultSearch] = useState('')
  const [tablePage, setTablePage] = useState(1)
  const editor = useRef<EditorView | null>(null)
  const request = useRef<AbortController | null>(null)
  const executeRef = useRef<() => void>(() => {})
  const tab = tabs.find((t) => t.id === activeTab) || tabs[0]
  const { connectionId, database, table: selectedTable } = tab
  const connection = connections.find((c) => c.id === connectionId)
  const engine = databaseTypeInfo(connection?.type)
  // 元数据重新加载后同时校验前台和后台标签，清除已不存在的库。
  const validateDatabases = useCallback((id: string, databases: string[]) => {
    setTabs((previous) => {
      let changed = false
      const next = previous.map((item) => {
        if (item.connectionId !== id || !item.database || databases.includes(item.database)) return item
        changed = true
        return { ...item, database: '', table: '' }
      })
      return changed ? next : previous
    })
  }, [])
  const objects = useDatabaseObjects(connectionId, database, validateDatabases)
  const resultTabs = resultSets[activeTab] || []
  const run = resultTabs.find((item) => item.id === selectedResult[activeTab]) || runs[activeTab]
  const result = run?.result

  const applyConnections = useCallback((data: Connection[]) => {
    setConnections(data)
    setTabs((previous) => previous.map((item) => (data.some((c) => c.id === item.connectionId) ? item : { ...item, connectionId: '', database: '', table: '' })))
  }, [])
  const loadConnections = useCallback(async () => {
    setConnectionLoading(true)
    setConnectionError('')
    try {
      const data = await getConnections()
      applyConnections(data)
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : '连接列表加载失败')
    } finally {
      setConnectionLoading(false)
    }
  }, [applyConnections])
  useEffect(() => {
    const controller = new AbortController()
    getConnections(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        applyConnections(data)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setConnectionError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setConnectionLoading(false)
      })
    return () => controller.abort()
  }, [applyConnections])
  useEffect(() => saveLocal('sqldesk.tabs', tabs), [tabs])
  useEffect(() => saveLocal('sqldesk.activeTab', activeTab), [activeTab])
  useEffect(() => saveLocal('sqldesk.history', history), [history])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!objects.connected || !connectionId || !database || !objects.databases.includes(database) || !selectedTable) return
    const controller = new AbortController()
    Promise.all([getColumns(connectionId, database, selectedTable, controller.signal), getDDL(connectionId, database, selectedTable, controller.signal)])
      .then(([c, d]) => {
        if (!controller.signal.aborted) {
          setColumns(c)
          setDDL(d.ddl)
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setStructureError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setStructureLoading(false)
      })
    return () => controller.abort()
  }, [connectionId, database, selectedTable, refresh, objects.connected, objects.databases])
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

  function updateTab(patch: Partial<QueryTab>) {
    setTabs((prev) => prev.map((t) => (t.id === activeTab ? { ...t, ...patch } : t)))
  }
  function updateSQL(value: string) {
    updateTab({ sql: value })
  }
  function exportCurrentSQL() {
    if (!tab.sql.trim()) return
    try {
      exportSQL(tab.sql, tab.title)
    } catch {
      message.error('SQL 导出失败，请重试')
    }
  }
  function openHistory() {
    if (!connection) return
    setHistorySearch('')
    setHistoryOpen(true)
  }
  function resetStructure(loading = false) {
    setColumns([])
    setDDL('')
    setStructureError('')
    setStructureLoading(loading)
  }
  function refreshSchema(id = connectionId) {
    if (!id || running) return
    if (id === connectionId) {
      resetStructure(Boolean(selectedTable))
      setRefresh((n) => n + 1)
    }
    void objects.refreshConnection(id).catch(() => {})
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
    if (running) return Promise.resolve([])
    const status = objects.snapshots[id]?.status
    if (status !== 'connected' && status !== 'loading') {
      // 打开连接不沿用持久化草稿中的库表；只有用户显式选择才设置查询范围。
      setTabs((previous) => previous.map((item) => (item.connectionId === id ? { ...item, database: '', table: '' } : item)))
      if (id === connectionId) resetStructure()
    }
    return objects.openConnection(id)
  }
  function closeConnection(id: string) {
    if (running) return
    objects.closeConnection(id)
    setTabs((previous) => previous.map((item) => (item.connectionId === id ? { ...item, connectionId: '', database: '', table: '' } : item)))
    if (id === connectionId) resetStructure()
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
  function selectTab(id: string) {
    const next = tabs.find((item) => item.id === id)
    if (next && (next.connectionId !== connectionId || next.database !== database || next.table !== selectedTable)) resetStructure(Boolean(next.table))
    setActiveTab(id)
    setResultSearch('')
    setTablePage(1)
  }
  // 结果采用不可变快照，菜单目标和发起查询标签均固定，不能被后续选择覆盖。
  function publishResult(tabId: string, value: RunState) {
    const snapshot = { ...value, id: crypto.randomUUID() }
    setResultSets((previous) => ({ ...previous, [tabId]: [...(previous[tabId] || []), snapshot] }))
    setSelectedResult((previous) => ({ ...previous, [tabId]: snapshot.id }))
  }
  function selectResult(id: string) {
    setSelectedResult((previous) => ({ ...previous, [activeTab]: id }))
    setResultSearch('')
    setTablePage(1)
  }
  function closeResult(id: string) {
    const remaining = resultTabs.filter((item) => item.id !== id)
    setResultSets((previous) => ({ ...previous, [activeTab]: remaining }))
    if (selectedResult[activeTab] === id) setSelectedResult((previous) => ({ ...previous, [activeTab]: remaining.at(-1)?.id || '' }))
    if (!remaining.length) setRuns((previous) => ({ ...previous, [activeTab]: { source: '' } }))
  }
  function databaseAction(action: string, id: string, db: string) {
    if (running || request.current || objects.snapshots[id]?.status !== 'connected') return
    const scope = { connectionId: id, database: db, table: '' }
    if (action === 'new') addTab('', scope)
    else if (action === 'tables') void executeSQL(`SHOW FULL TABLES FROM ${identifier(db)};`, scope)
    else if (action === 'select') selectObject(db, undefined, id)
    else if (action === 'refresh') refreshSchema(id)
  }
  async function tableAction(action: string, connectionId: string, db: string, table: string) {
    const connection = connections.find((item) => item.id === connectionId)
    if (running || request.current || !connection || objects.snapshots[connectionId]?.status !== 'connected') return
    const scope = { connectionId, database: db, table }
    const statement = `SELECT * FROM ${identifier(db)}.${identifier(table)} LIMIT 1000;`
    if (action === 'new') {
      addTab(statement, scope)
      return
    }
    if (action === 'data') {
      void executeSQL(statement, scope)
      return
    }
    const id = activeTab
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    const source = `${connection.name} / ${db} / ${table}`
    try {
      const fields = action === 'ddl' ? [] : await getColumns(connectionId, db, table, controller.signal)
      const definition = action === 'ddl' ? await getDDL(connectionId, db, table, controller.signal) : undefined
      const rows = definition ? [[definition.ddl]] : fields.map((field) => [field.name, field.type, field.nullable, field.key, field.default, field.extra, field.comment])
      publishResult(id, {
        kind: action === 'ddl' ? 'ddl' : 'structure',
        title: `${table} · ${action === 'ddl' ? 'DDL' : '结构'}`,
        source,
        result: {
          columns: (definition ? ['DDL'] : ['字段名', '类型', '允许 NULL', '索引', '默认值', '额外属性', '注释']).map((name) => ({ name, type: '' })),
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
      publishResult(id, {
        kind: action === 'ddl' ? 'ddl' : 'structure',
        title: `${table} · ${action === 'ddl' ? 'DDL' : '结构'}`,
        source,
        error: controller.signal.aborted ? '请求已取消' : error instanceof Error ? error.message : '结构加载失败'
      })
    } finally {
      request.current = null
      setRunning(false)
    }
  }
  async function executeSQL(statement: string, scope?: QueryScope) {
    const database = scope?.database ?? tab.database
    const targetConnectionId = scope?.connectionId ?? connectionId
    const connection = connections.find((item) => item.id === targetConnectionId)
    if (!connection || objects.snapshots[targetConnectionId]?.status !== 'connected' || running || request.current) return
    if (!statement.trim()) {
      message.info('请先输入 SQL 语句')
      return
    }
    // 固定本次请求的标签和范围，切换标签后也不能把结果写到其他窗口。
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setResultSearch('')
    setTablePage(1)
    const id = activeTab
    const source = `${connection.name} / ${database || '未选择数据库'}`
    setRuns((prev) => ({ ...prev, [id]: { source } }))
    const start = performance.now()
    const item: HistoryItem = {
      id: crypto.randomUUID(),
      sql: statement,
      database,
      connectionId: targetConnectionId,
      connectionName: connection.name,
      time: new Date().toISOString(),
      durationMs: 0,
      ok: false
    }
    try {
      const output = await executeQuery(targetConnectionId, { database, sql: statement }, controller.signal)
      setRuns((prev) => ({ ...prev, [id]: { result: output, source } }))
      publishResult(id, { kind: scope?.table ? 'data' : 'query', result: output, source, title: scope?.table ? `${scope.table} · 数据` : 'SQL 结果' })
      item.ok = true
      item.durationMs = output.durationMs
      if (!output.isQuery) {
        message.success(`执行成功，影响 ${output.affectedRows} 行`)
        refreshSchema()
      }
    } catch (e) {
      const error = controller.signal.aborted ? '请求已取消。' : e instanceof Error ? e.message : '查询失败'
      setRuns((prev) => ({ ...prev, [id]: { error, source } }))
      publishResult(id, { kind: scope?.table ? 'data' : 'query', error, source, title: scope?.table ? `${scope.table} · 数据` : 'SQL 结果' })
      item.error = error
      item.durationMs = Math.round(performance.now() - start)
    } finally {
      setHistory((prev) => [item, ...prev].slice(0, 50))
      request.current = null
      setRunning(false)
    }
  }
  function runSQL() {
    if (!connection || !objects.connected) {
      message.info('请先展开连接并加载数据库结构')
      return
    }
    if (running) return
    const state = editor.current?.state
    const selection = state?.selection.main
    const statement = state && selection && !selection.empty ? state.sliceDoc(selection.from, selection.to) : tab.sql
    void executeSQL(statement)
  }
  useEffect(() => {
    executeRef.current = runSQL
  })
  function addTab(statement?: string, scope?: QueryScope, title?: string) {
    if (running) return
    const added = { ...newTab(tabs.length + 1), connectionId, database, table: selectedTable, ...scope }
    if (statement) added.sql = statement
    if (title) added.title = title
    setTabs((prev) => [...prev, added])
    selectTab(added.id)
    if (added.connectionId !== connectionId || added.database !== database || added.table !== selectedTable) resetStructure(Boolean(added.table))
  }
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
    if (running) return
    const targetIndex = tabs.findIndex((item) => item.id === key)
    if (targetIndex < 0) return
    const target = tabs[targetIndex]
    const remaining = tabs.filter((item, index) => (mode === 'others' ? item.id === key : mode === 'right' ? index <= targetIndex : item.id !== key))
    // 工作区始终保留一个编辑器，关闭最后一页时创建空白查询。
    const next = remaining.length ? remaining : [{ ...newTab(1), connectionId: target.connectionId, database: target.database }]
    const retained = new Set(next.map((item) => item.id))
    const keep = <T,>(records: Record<string, T>) => Object.fromEntries(Object.entries(records).filter(([id]) => retained.has(id)))
    setTabs(next)
    setResultSets(keep)
    setSelectedResult(keep)
    setRuns(keep)
    if (!retained.has(activeTab)) {
      const nextActive = retained.has(key) ? target : next[Math.min(targetIndex, next.length - 1)]
      selectTab(nextActive.id)
      if (!remaining.length) resetStructure()
    }
  }
  const closeTab = (key: string) => closeTabs(key)

  const cancelQuery = () => request.current?.abort()
  const onEditorReady = (view: EditorView) => {
    editor.current = view
  }
  const onConnectionSaved = (saved: Connection) => {
    setConnectionModal(false)
    objects.closeConnection(saved.id)
    // 编辑其他连接不改变当前查询；受影响草稿保留 SQL，重新展开后再选择库表。
    setTabs((previous) => previous.map((item) => (item.connectionId === saved.id || (!editing && item.id === activeTab) ? { ...item, connectionId: saved.id, database: '', table: '' } : item)))
    if (connectionId === saved.id || !editing) resetStructure()
    void loadConnections()
  }

  return {
    resultTabs,
    selectResult,
    closeResult,
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
    tabs,
    activeTab,
    tab,
    selectTab,
    addTab,
    updateSQL,
    exportCurrentSQL,
    runSQL,
    running,
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
    resultSearch,
    setResultSearch,
    tablePage,
    setTablePage,
    history,
    openHistory,
    setHistory,
    historyOpen,
    setHistoryOpen,
    historySearch,
    setHistorySearch,
    database,
    selectedTable,
    refresh,
    refreshSchema,
    closeTab,
    closeTabs,
    cancelQuery,
    onEditorReady,
    onConnectionSaved
  }
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>
