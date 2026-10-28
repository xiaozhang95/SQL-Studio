import { App, Form } from 'antd'
import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { ObjectAction } from '@/databases/typings/objectManagement'
import type { CollationOption, DatabaseDefinition, FieldDefinition, ObjectChange, ObjectFormValues, ObjectTarget } from '@/databases/typings/objectManagement'
import { executeObjectSQL, executeQuery, getColumns, getDDL } from '@/services/database'
import type { Connection } from '@/typings/database'

type InitialOperation = { action: ObjectAction; target: ObjectTarget }
type Options = {
  connections: Connection[]
  blocked: boolean
  onBusyChange: (busy: boolean) => void
  onChanged: (change: ObjectChange) => Promise<void>
  initial?: InitialOperation
  keepOpen?: boolean
  onDirtyChange?: (dirty: boolean) => void
}
type Dialog = { action: ObjectAction; target: ObjectTarget; connection: Connection }
const titles: Record<ObjectAction, string> = {
  createDatabase: '新建数据库',
  editDatabase: '编辑数据库',
  dropDatabase: '删除数据库',
  createSchema: '新建 Schema',
  renameSchema: '重命名 Schema',
  dropSchema: '删除 Schema',
  createTable: '新建表',
  editTable: '设计表',
  dropTable: '删除表',
  truncateTable: '清空表',
  renameTable: '重命名表'
}
/** 元数据、表单和写入均绑定打开菜单时的显式连接与对象；普通编辑器不获得写入权限。 */
export function useObjectManagement({ connections, blocked, onBusyChange, onChanged, initial, keepOpen = false, onDirtyChange }: Options) {
  const { message } = App.useApp()
  const [form] = Form.useForm<ObjectFormValues>()
  const [dialog, setDialog] = useState<Dialog>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [collations, setCollations] = useState<CollationOption[]>([])
  const [original, setOriginal] = useState<FieldDefinition[]>([])
  const [sqlMode, setSQLMode] = useState('')
  const [previewSQL, setPreviewSQL] = useState('')
  const [dirty, setDirty] = useState(false)
  const [originalDDL, setOriginalDDL] = useState('')
  const [databaseDefinition, setDatabaseDefinition] = useState<DatabaseDefinition>()
  const request = useRef<AbortController | null>(null)
  const currentDialog = useRef<Dialog | undefined>(undefined)
  const busyChange = useRef(onBusyChange)
  useEffect(() => {
    busyChange.current = onBusyChange
  }, [onBusyChange])
  useEffect(
    () => () => {
      const controller = request.current
      request.current = null
      currentDialog.current = undefined
      controller?.abort()
      busyChange.current(false)
    },
    []
  )
  const release = (controller: AbortController) => {
    if (request.current === controller) {
      request.current = null
      setLoading(false)
      setSaving(false)
      onBusyChange(false)
    }
  }
  const close = () => {
    if (saving) return
    request.current?.abort()
    request.current = null
    currentDialog.current = undefined
    setDialog(undefined)
    setLoading(false)
    onBusyChange(false)
  }
  async function open(action: ObjectAction, target: ObjectTarget) {
    if (blocked || request.current) return
    const connection = connections.find((value) => value.id === target.connectionId)
    if (!connection) return
    const engine = getDatabaseAdapter(connection.type)
    const adapter = engine.objects
    const simple = engine.simpleObjects
    const designer = engine.tableDesign
    const tableAction = action === ObjectAction.CreateTable || action === ObjectAction.EditTable
    if (!adapter && !(tableAction && designer) && !(action === ObjectAction.EditDatabase && engine.databaseEditor) && !simple?.actions.includes(action)) {
      message.info('该引擎暂不支持可视化结构管理')
      return
    }
    const controller = new AbortController()
    request.current = controller
    onBusyChange(true)
    const next = { action, target: { ...target }, connection: { ...connection } }
    currentDialog.current = next
    setDialog(next)
    setLoading(true)
    setReady(false)
    setError('')
    setPreviewSQL('')
    setDirty(false)
    onDirtyChange?.(false)
    setCollations([])
    setOriginal([])
    setDatabaseDefinition(undefined)
    setSQLMode('')
    const values: ObjectFormValues = {
      name: tableAction
        ? action === ObjectAction.CreateTable
          ? ''
          : (engine.explorer?.tableIdentity(target.table).name ?? target.table)
        : simple
          ? simple.initialName(action, target)
          : action === ObjectAction.CreateDatabase
            ? ''
            : target.table || target.database,
      charset: '',
      collation: '',
      fields: [],
      confirmation: ''
    }
    let loadedCollations: CollationOption[] = []
    let loadedOriginal: FieldDefinition[] = []
    let loadedMode = ''
    let loadedDDL = ''
    form.resetFields()
    form.setFieldsValue(values)
    try {
      if (action === ObjectAction.EditDatabase && engine.databaseEditor) {
        const result = await executeQuery(connection.id, { database: '', sql: engine.databaseEditor.metadataSQL(target.database) }, controller.signal)
        const definition = engine.databaseEditor.definition(result)
        if (controller.signal.aborted || request.current !== controller) return
        values.name = definition.name
        values.owner = definition.owner
        values.connectionLimit = definition.connectionLimit
        values.comment = definition.comment
        setDatabaseDefinition(definition)
      }
      if (adapter && (action === ObjectAction.CreateDatabase || action === ObjectAction.EditDatabase)) {
        const result = await executeQuery(connection.id, { database: '', sql: adapter.collationsSQL, limit: 5000 }, controller.signal)
        if (result.truncated) throw new Error('排序规则列表不完整，无法安全加载表单')
        const options = adapter.collations(result)
        loadedCollations = options
        if (action === ObjectAction.EditDatabase) {
          const metadata = await executeQuery(connection.id, { database: '', sql: adapter.databaseInfoSQL(target.database) }, controller.signal)
          const definition = adapter.databaseDefinition(metadata)
          values.charset = definition.charset
          values.collation = definition.collation
        } else {
          const initial = adapter.defaultCollation(options)
          if (!initial) throw new Error('没有可用的字符集或排序规则')
          values.charset = initial.charset
          values.collation = initial.name
        }
      }
      if (adapter && (action === ObjectAction.CreateTable || action === ObjectAction.EditTable)) {
        const result = await executeQuery(connection.id, { database: target.database, sql: adapter.sqlModeSQL }, controller.signal)
        const mode = result.rows[0]?.[0]
        if (typeof mode !== 'string') throw new Error('无法读取 SQL 模式')
        loadedMode = mode
        if (action === ObjectAction.EditTable) {
          const [columns, definition] = await Promise.all([
            getColumns(connection.id, target.database, target.table, controller.signal),
            getDDL(connection.id, target.database, target.table, controller.signal)
          ])
          loadedDDL = definition.ddl
          const fields = adapter.fields(columns, definition.ddl)
          loadedOriginal = fields
          values.fields = fields.map((value) => ({ ...value }))
        } else values.fields = adapter.initialFields()
      }
      if (designer && tableAction) {
        if (action === ObjectAction.EditTable) {
          const [columns, definition] = await Promise.all([
            getColumns(connection.id, target.database, target.table, controller.signal),
            getDDL(connection.id, target.database, target.table, controller.signal)
          ])
          loadedDDL = definition.ddl
          loadedOriginal = designer.fields(columns, definition.ddl)
          values.fields = loadedOriginal.map((field) => ({ ...field }))
        } else values.fields = designer.initialFields()
      }
      if (controller.signal.aborted || request.current !== controller) return
      setCollations(loadedCollations)
      setOriginal(loadedOriginal)
      setSQLMode(loadedMode)
      setOriginalDDL(loadedDDL)
      form.setFieldsValue(values)
      setReady(true)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '对象信息加载失败')
    } finally {
      release(controller)
    }
  }
  async function build() {
    if (!dialog || !ready) throw new Error('请先完成对象信息加载')
    await form.validateFields()
    const values: ObjectFormValues = form.getFieldsValue(true)
    const { action, target, connection } = dialog
    if (
      [ObjectAction.DropDatabase, ObjectAction.DropSchema, ObjectAction.DropTable, ObjectAction.TruncateTable].some((value) => value === action) &&
      values.confirmation !== (action === ObjectAction.DropSchema ? target.schema : target.table || target.database)
    )
      throw new Error('请输入完整对象名称确认操作')
    const engine = getDatabaseAdapter(connection.type)
    if (engine.objects && (action === ObjectAction.CreateDatabase || action === ObjectAction.EditDatabase)) {
      if (!collations.some((value) => value.charset === values.charset && value.name === values.collation)) throw new Error('排序规则与字符集不匹配')
    }
    const adapter = engine.objects
    const designer = engine.tableDesign
    const tableAction = action === ObjectAction.CreateTable || action === ObjectAction.EditTable
    const databaseEdit = action === ObjectAction.EditDatabase && engine.databaseEditor
    if (!adapter && !(designer && tableAction) && !databaseEdit && !engine.simpleObjects?.actions.includes(action)) throw new Error('该引擎暂不支持此操作')
    if (databaseEdit && !databaseDefinition) throw new Error('请重新加载数据库属性')
    const sql =
      databaseEdit && databaseDefinition
        ? databaseEdit.sql(target.database, values, databaseDefinition)
        : adapter
          ? adapter.sql(action, target, values, original, sqlMode)
          : designer && tableAction
            ? designer.sql(action, target, values, original)
            : engine.simpleObjects!.sql(action, target, values.name)
    return { sql, values, dialog }
  }
  async function preview() {
    try {
      const value = await build()
      if (currentDialog.current !== value.dialog) return
      setPreviewSQL(value.sql)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '请检查表单内容')
    }
  }
  async function save() {
    if (blocked || request.current || !dialog) return
    let built: Awaited<ReturnType<typeof build>>
    try {
      built = await build()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '请检查表单内容')
      return
    }
    if (request.current || currentDialog.current !== built.dialog) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    onBusyChange(true)
    setError('')
    let reopen: ObjectTarget | undefined
    try {
      const { action, target, connection } = built.dialog
      if (keepOpen && action === ObjectAction.EditTable) {
        const engine = getDatabaseAdapter(connection.type)
        const [latest, columns] = await Promise.all([
          getDDL(connection.id, target.database, target.table, controller.signal),
          engine.tableDesign ? getColumns(connection.id, target.database, target.table, controller.signal) : Promise.resolve(undefined)
        ])
        if (!(engine.objects ?? engine.tableDesign)?.sameDefinition(latest.ddl, originalDDL)) throw new Error('表结构已被其他操作修改，请重新加载后再编辑')
        if (columns && JSON.stringify(engine.tableDesign?.fields(columns, latest.ddl)) !== JSON.stringify(original)) throw new Error('字段或注释已被其他操作修改，请重新加载后再编辑')
      }
      if (controller.signal.aborted || currentDialog.current !== built.dialog) return
      await executeObjectSQL(
        connection.id,
        action === ObjectAction.CreateDatabase || action === ObjectAction.EditDatabase || action === ObjectAction.DropDatabase ? '' : target.database,
        built.sql,
        controller.signal
      )
      if (controller.signal.aborted) return
      if (!keepOpen) {
        currentDialog.current = undefined
        setDialog(undefined)
      }
      setDirty(false)
      onDirtyChange?.(false)
      message.success(titles[action] + '成功')
      try {
        const engine = getDatabaseAdapter(connection.type)
        const name =
          action === ObjectAction.CreateTable && engine.tableDesign
            ? engine.tableDesign.identity(target, built.values.name)
            : action === ObjectAction.EditTable
              ? target.table
              : (engine.simpleObjects?.resultName(action, target, built.values.name) ?? built.values.name)
        await onChanged({ action, target, name })
      } catch (reason) {
        message.warning('操作已生效，但对象刷新失败，请手动刷新。' + (reason instanceof Error ? reason.message : ''))
      }
      if (keepOpen)
        reopen = { ...target, table: action === ObjectAction.CreateTable ? (getDatabaseAdapter(connection.type).tableDesign?.identity(target, built.values.name) ?? built.values.name) : target.table }
    } catch (reason) {
      if (!controller.signal.aborted) setError((reason instanceof Error ? reason.message : '操作失败') + '；如连接在提交时断开，请刷新核对实际状态后再决定是否重试。')
    } finally {
      release(controller)
    }
    if (reopen && !controller.signal.aborted) await open(ObjectAction.EditTable, reopen)
  }
  const initialize = useEffectEvent(() => {
    if (initial && !blocked && !request.current && !currentDialog.current) void open(initial.action, initial.target)
  })
  useEffect(() => {
    initialize()
  }, [initial, blocked, connections])
  const reload = () => (dialog ? open(dialog.action, dialog.target) : initial ? open(initial.action, initial.target) : Promise.resolve())
  const engine = getDatabaseAdapter(dialog?.connection.type)
  const adapter = engine.objects ?? engine.tableDesign
  return {
    form,
    dialog,
    title: dialog ? titles[dialog.action] : '',
    loading,
    saving,
    ready,
    error,
    collations,
    original,
    databaseDefinition,
    previewSQL,
    dirty,
    reload,
    fieldTypes: adapter?.fieldTypes ?? [],
    defaultField: () => {
      if (!adapter) throw new Error('该引擎暂不支持可视化结构管理')
      return adapter.defaultField()
    },
    open,
    close,
    save,
    preview,
    invalidatePreview: () => {
      setPreviewSQL('')
      setDirty(true)
      onDirtyChange?.(true)
    }
  }
}
