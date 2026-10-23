import type { EditorView } from '@codemirror/view'
import { App as AntApp } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'

import { databaseTypeInfo } from '@/constant/database'
import { executeQuery, getColumns, getConnections, getDDL, deleteConnection as removeConnection } from '@/services/database'
import type { Column, Connection, QueryResult } from '@/typings/database'
import type { HistoryItem, QueryScope, QueryTab } from '@/typings/workspace'
import { identifier } from '@/utils/sql'
import { readLocal, saveLocal } from '@/utils/storage'

import { useDatabaseObjects } from '../useDatabaseObjects'

type RunState = { id?: string; title?: string; result?: QueryResult; error?: string; source: string }
const initialSQL = 'SELECT 1;'
const newTab = (n: number): QueryTab => ({
  id: crypto.randomUUID(),
  title: `查询 ${n}`,
  sql: initialSQL,
  connectionId: '',
  database: '',
  table: '',
  schema: ''
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
      table: typeof t.table === 'string' ? t.table : '',
      schema: typeof t.schema === 'string' ? t.schema : ''
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
  const [resultsCollapsed, setResultsCollapsed] = useState(false)
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
  const { connectionId, database, table: selectedTable, schema: selectedSchema } = tab
  const connection = connections.find((c) => c.id === connectionId)
  const engine = databaseTypeInfo(connection?.type)
  const postgres = engine.protocol === 'postgresql'
  const objects = useDatabaseObjects(connectionId, database, refresh)
  const resultTabs = resultSets[activeTab] || []
  const run = resultTabs.find((item) => item.id === selectedResult[activeTab]) || runs[activeTab]
  const result = run?.result

  const applyConnections = useCallback((data: Connection[]) => {
    setConnections(data)
    setTabs((previous) => previous.map((item) => (data.some((c) => c.id === item.connectionId) ? item : { ...item, connectionId: data[0]?.id || '', database: '', table: '', schema: '' })))
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
    if (!connectionId || !database || !selectedTable) return
    const controller = new AbortController()
    Promise.all([getColumns(connectionId, database, selectedTable, controller.signal, selectedSchema), getDDL(connectionId, database, selectedTable, controller.signal, selectedSchema)])
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
  }, [connectionId, database, selectedTable, selectedSchema, refresh])
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
  function resetStructure(loading = false) {
    setColumns([])
    setDDL('')
    setStructureError('')
    setStructureLoading(loading)
  }
  function refreshSchema() {
    resetStructure(Boolean(selectedTable))
    setRefresh((n) => n + 1)
  }
  function selectConnection(id: string) {
    if (running) return
    updateTab({ connectionId: id, database: '', table: '', schema: '' })
    resetStructure()
  }
  function selectObject(db: string, table?: string, schema = '') {
    if (running) return
    if (db !== database || (table || '') !== selectedTable || schema !== selectedSchema) resetStructure(Boolean(table))
    updateTab({ database: db, table: table || '', schema })
  }
  function selectTab(id: string) {
    const next = tabs.find((item) => item.id === id)
    if (next && (next.connectionId !== connectionId || next.database !== database || next.table !== selectedTable || next.schema !== selectedSchema)) resetStructure(Boolean(next.table))
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
  async function tableAction(action: string, db: string, table: string, schema = '') {
    if (running || request.current || !connection) return
    const scope = { connectionId, database: db, table, schema }
    const statement = `SELECT * FROM ${identifier(postgres ? schema || 'public' : db, postgres)}.${identifier(table, postgres)} LIMIT 1000;`
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
    setResultsCollapsed(false)
    const source = `${connection.name} / ${db} / ${schema ? schema + '.' : ''}${table}`
    try {
      const fields = action === 'ddl' ? [] : await getColumns(connectionId, db, table, controller.signal, schema)
      const definition = action === 'ddl' ? await getDDL(connectionId, db, table, controller.signal, schema) : undefined
      const rows = definition ? [[definition.ddl]] : fields.map((field) => [field.name, field.type, field.nullable, field.key, field.default, field.extra, field.comment])
      publishResult(id, {
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
      publishResult(id, { title: `${table} · ${action === 'ddl' ? 'DDL' : '结构'}`, source, error: controller.signal.aborted ? '请求已取消' : error instanceof Error ? error.message : '结构加载失败' })
    } finally {
      request.current = null
      setRunning(false)
    }
  }
  async function executeSQL(statement: string, scope?: QueryScope) {
    const database = scope?.database ?? tab.database
    const selectedSchema = scope?.schema ?? tab.schema
    if (!connection || running || request.current) return
    if (!statement.trim()) {
      message.info('请先输入 SQL 语句')
      return
    }
    // 固定本次请求的标签和范围，切换标签后也不能把结果写到其他窗口。
    const controller = new AbortController()
    request.current = controller
    setRunning(true)
    setResultsCollapsed(false)
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
      schema: selectedSchema,
      connectionId,
      connectionName: connection.name,
      time: new Date().toISOString(),
      durationMs: 0,
      ok: false
    }
    try {
      const output = await executeQuery(connectionId, { database, schema: selectedSchema, sql: statement }, controller.signal)
      setRuns((prev) => ({ ...prev, [id]: { result: output, source } }))
      publishResult(id, { result: output, source, title: scope?.table ? `${scope.table} · 数据` : 'SQL 结果' })
      item.ok = true
      item.durationMs = output.durationMs
      if (!output.isQuery) {
        message.success(`执行成功，影响 ${output.affectedRows} 行`)
        refreshSchema()
      }
    } catch (e) {
      const error = controller.signal.aborted ? '请求已取消。' : e instanceof Error ? e.message : '查询失败'
      setRuns((prev) => ({ ...prev, [id]: { error, source } }))
      publishResult(id, { error, source, title: 'SQL 结果' })
      item.error = error
      item.durationMs = Math.round(performance.now() - start)
    } finally {
      setHistory((prev) => [item, ...prev].slice(0, 50))
      request.current = null
      setRunning(false)
    }
  }
  function runSQL() {
    if (!connection) {
      message.info('请先创建并选择数据库连接')
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
    const added = { ...newTab(tabs.length + 1), connectionId, database, table: selectedTable, schema: selectedSchema, ...scope }
    if (statement) added.sql = statement
    if (title) added.title = title
    setTabs((prev) => [...prev, added])
    selectTab(added.id)
    if (added.connectionId !== connectionId || added.database !== database || added.table !== selectedTable || added.schema !== selectedSchema) resetStructure(Boolean(added.table))
  }
  function deleteConnection() {
    if (!connection) return
    modal.confirm({
      title: `删除连接「${connection.name}」？`,
      content: '删除本机保存的连接信息，数据库中的数据不受影响。',
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeConnection(connection.id)
        resetStructure()
        await loadConnections()
      }
    })
  }

  const closeTab = (key: string) => {
    if (running || tabs.length < 2) return
    const next = tabs.filter((item) => item.id !== key)
    setTabs(next)
    setResultSets((previous) => {
      const copy = { ...previous }
      delete copy[key]
      return copy
    })
    setSelectedResult((previous) => {
      const copy = { ...previous }
      delete copy[key]
      return copy
    })
    if (activeTab === key) selectTab(next[0].id)
    setRuns((previous) => {
      const copy = { ...previous }
      delete copy[key]
      return copy
    })
  }
  const cancelQuery = () => request.current?.abort()
  const onEditorReady = (view: EditorView) => {
    editor.current = view
  }
  const onConnectionSaved = (saved: Connection) => {
    // 连接类型或凭据改变后，只清理引用该连接的标签范围。
    setConnectionModal(false)
    setTabs((previous) => previous.map((item) => (item.id === activeTab || item.connectionId === saved.id ? { ...item, connectionId: saved.id, database: '', table: '', schema: '' } : item)))
    resetStructure()
    setRefresh((value) => value + 1)
    void loadConnections()
  }
  return {
    resultTabs,
    selectResult,
    closeResult,
    tableAction,
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
    runSQL,
    running,
    updateTab,
    editor,
    postgres,
    objects,
    selectObject,
    columns,
    ddl,
    structureError,
    structureLoading,
    run,
    result,
    resultsCollapsed,
    setResultsCollapsed,
    resultSearch,
    setResultSearch,
    tablePage,
    setTablePage,
    history,
    setHistory,
    historyOpen,
    setHistoryOpen,
    historySearch,
    setHistorySearch,
    database,
    selectedTable,
    selectedSchema,
    refresh,
    refreshSchema,
    closeTab,
    cancelQuery,
    onEditorReady,
    onConnectionSaved
  }
}
export type WorkspaceModel = ReturnType<typeof useWorkspace>
