import { App } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'

import { getDatabaseAdapter } from '@/databases'
import { executeObjectSQL, executeQuery, getColumns, getTables } from '@/services/database'
import type { Column, Connection, QueryResult } from '@/typings/database'
import type { WorkspaceTab } from '@/typings/workspace'

type Options = {
  tab: WorkspaceTab
  connection?: Connection
  result?: QueryResult
  blocked: boolean
  onBusyChange: (id: string, busy: boolean) => void
  onDirtyChange: (id: string, dirty: boolean) => void
  onResult: (id: string, result: QueryResult) => void
}
type Cell = { row: number; column: number; type: string; value: string; isNull: boolean; nullable: boolean; columns: Column[] }
/** 仅对象数据页显式保存；每次打开编辑重新检查主键与对象类型，写入后读取服务端真实值。 */
export function useDataEditing({ tab, connection, result, blocked, onBusyChange, onDirtyChange, onResult }: Options) {
  const { message, modal } = App.useApp()
  const [cell, setCell] = useState<Cell>()
  const [drafts, setDrafts] = useState<Record<string, Cell>>({})
  const [newRows, setNewRows] = useState<{ key: number; cells: unknown[]; columns: Column[] }[]>([])
  const nextKey = useRef(-1)
  const previewRows = useMemo(() => {
    if (!result || !Object.keys(drafts).length) return result?.rows ?? []
    const rows = result.rows.slice()
    const copied = new Set<number>()
    for (const draft of Object.values(drafts)) {
      if (!copied.has(draft.row)) {
        rows[draft.row] = [...rows[draft.row]]
        copied.add(draft.row)
      }
      rows[draft.row][draft.column] = draft.isNull ? null : draft.value
    }
    return rows
  }, [result, drafts])
  const dirty = Object.keys(drafts).length + newRows.length
  useEffect(() => {
    onDirtyChange(tab.id, dirty > 0)
    return () => onDirtyChange(tab.id, false)
  }, [dirty, tab.id, onDirtyChange])
  const [deletionError, setDeletionError] = useState<{ page: string; detail: string }>()
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const busyChange = useRef(onBusyChange)
  useEffect(() => {
    busyChange.current = onBusyChange
  }, [onBusyChange])
  useEffect(
    () => () => {
      request.current?.abort()
      busyChange.current(tab.id, false)
    },
    [tab.id]
  )
  async function begin(row: number, column: number) {
    if (blocked || request.current || !result || !connection || tab.kind !== 'data') return
    const controller = new AbortController()
    request.current = controller
    onBusyChange(tab.id, true)
    try {
      const [columns, tables] = await Promise.all([getColumns(tab.connectionId, tab.database, tab.table, controller.signal), getTables(tab.connectionId, tab.database, controller.signal)])
      if (controller.signal.aborted) return
      const table = tables.find((item) => item.name === tab.table)
      if (!table || table.type.includes('VIEW')) throw new Error('视图不支持直接编辑，请打开基础表')
      const draft = drafts[row + ':' + column]
      const added = newRows.find((item) => item.key === row)
      const original = added ? added.cells[column] : result.rows[row]?.[column]
      const adapter = getDatabaseAdapter(connection.type)
      if (added) {
        const field = columns.find((item) => item.name === result.columns[column].name)
        if (!field || !adapter.canInsertColumn(field)) throw new Error('该字段由数据库生成或暂不支持编辑')
      } else adapter.updateCellSQL(tab.database, tab.table, columns, result, result.rows[row], column, original === null ? null : String(original))
      setCell({
        type: columns.find((item) => item.name === result.columns[column].name)?.type ?? '',
        row,
        column,
        value: draft?.value ?? (original == null ? '' : String(original)),
        isNull: draft?.isNull ?? original === null,
        nullable: columns.find((item) => item.name === result.columns[column].name)?.nullable === 'YES',
        columns
      })
    } catch (error) {
      if (!controller.signal.aborted) message.error(error instanceof Error ? error.message : '无法编辑单元格')
    } finally {
      if (request.current === controller) {
        request.current = null
        onBusyChange(tab.id, false)
      }
    }
  }
  function change(patch: Partial<Pick<Cell, 'value' | 'isNull'>>) {
    if (!cell || !result) return
    const next = { ...cell, ...patch }
    setCell(next)
    if (cell.row < 0) {
      setNewRows((previous) =>
        previous.map((row) => (row.key === cell.row ? { ...row, cells: row.cells.map((value, index) => (index === cell.column ? (next.isNull ? null : next.value) : value)) } : row))
      )
      return
    }
    const original = result.rows[cell.row][cell.column]
    const unchanged = next.isNull ? original === null : original !== null && next.value === String(original)
    setDrafts((previous) => {
      const updated = { ...previous }
      const key = cell.row + ':' + cell.column
      if (unchanged) delete updated[key]
      else updated[key] = next
      return updated
    })
  }
  async function save() {
    if (!dirty || !result || !connection || blocked || request.current) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    onBusyChange(tab.id, true)
    const pending = { ...drafts }
    const pendingNew = [...newRows]
    const working = { ...result, rows: result.rows.map((row) => [...row]) }
    let saved = 0
    try {
      const columns = await getColumns(tab.connectionId, tab.database, tab.table, controller.signal)
      if ([...Object.values(pending), ...pendingNew].some((draft) => JSON.stringify(draft.columns) !== JSON.stringify(columns))) throw new Error('表结构已变化，请放弃修改并重新打开表')
      const adapter = getDatabaseAdapter(connection.type)
      // 主键修改最后执行；每次成功后使用最新主键定位同一行的后续修改。
      const entries = Object.entries(pending).sort(
        ([, a], [, b]) => Number(columns.find((c) => c.name === result.columns[a.column].name)?.key === 'PRI') - Number(columns.find((c) => c.name === result.columns[b.column].name)?.key === 'PRI')
      )
      for (const [key, draft] of entries) {
        const value = draft.isNull ? null : draft.value
        const sql = adapter.updateCellSQL(tab.database, tab.table, columns, working, working.rows[draft.row], draft.column, value)
        const updated = await executeObjectSQL(tab.connectionId, tab.database, sql, controller.signal)
        if (updated.affectedRows !== 1) throw new Error('原值已变化或保存值未产生变更，请重新打开表确认')
        working.rows[draft.row][draft.column] = value
        delete pending[key]
        saved++
        setDrafts({ ...pending })
      }
      for (const row of [...pendingNew]) {
        const sql = adapter.insertRowSQL(tab.database, tab.table, columns, result, row.cells)
        const inserted = await executeObjectSQL(tab.connectionId, tab.database, sql, controller.signal)
        if (inserted.affectedRows !== 1) throw new Error('新增行未成功，请核对数据')
        pendingNew.splice(
          pendingNew.findIndex((item) => item.key === row.key),
          1
        )
        saved++
        setNewRows([...pendingNew])
      }
      setCell(undefined)
      const refreshed = await executeQuery(tab.connectionId, { database: tab.database, sql: adapter.tableDataSQL(tab.database, tab.table) }, controller.signal)
      if (!controller.signal.aborted) {
        onResult(tab.id, refreshed)
        message.success('已保存 ' + saved + ' 处修改')
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (saved) onResult(tab.id, working)
        message.error((saved ? '已有 ' + saved + ' 处保存成功，剩余 ' + (Object.keys(pending).length + pendingNew.length) + ' 处未保存。' : '') + (error instanceof Error ? error.message : '保存失败'))
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setSaving(false)
        onBusyChange(tab.id, false)
      }
    }
  }
  async function addRow() {
    if (blocked || request.current || !result || tab.kind !== 'data') return
    const controller = new AbortController()
    request.current = controller
    onBusyChange(tab.id, true)
    try {
      const [columns, tables] = await Promise.all([getColumns(tab.connectionId, tab.database, tab.table, controller.signal), getTables(tab.connectionId, tab.database, controller.signal)])
      if (controller.signal.aborted) return
      const table = tables.find((item) => item.name === tab.table)
      if (!table || table.type.includes('VIEW')) throw new Error('视图不支持新增行')
      setCell(undefined)
      setNewRows((previous) => [{ key: nextKey.current--, cells: result.columns.map(() => undefined), columns }, ...previous])
    } catch (error) {
      if (!controller.signal.aborted) message.error(error instanceof Error ? error.message : '新增失败')
    } finally {
      if (request.current === controller) {
        request.current = null
        onBusyChange(tab.id, false)
      }
    }
  }
  function deleteRows(keys: number[], onDeleted: () => void) {
    if (blocked || dirty || request.current || !result || !connection || tab.kind !== 'data' || !keys.length) return
    const selected = [...new Set(keys)].filter((key) => key >= 0 && result.rows[key])
    if (!selected.length) return
    modal.confirm({
      title: `删除选中的 ${selected.length} 行数据？`,
      content: '将按完整主键逐行删除。成功的删除立即生效；中途失败会停止，已完成的删除不会回滚。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        if (request.current) return
        const controller = new AbortController()
        request.current = controller
        setSaving(true)
        onBusyChange(tab.id, true)
        setDeletionError(undefined)
        const removed = new Set<number>()
        try {
          const [columns, tables] = await Promise.all([getColumns(tab.connectionId, tab.database, tab.table, controller.signal), getTables(tab.connectionId, tab.database, controller.signal)])
          const table = tables.find((item) => item.name === tab.table)
          if (!table || table.type.includes('VIEW')) throw new Error('视图不支持直接删除数据，请打开基础表')
          const adapter = getDatabaseAdapter(connection.type)
          const statements = selected.map((key) => ({ key, sql: adapter.deleteRowSQL(tab.database, tab.table, columns, result, result.rows[key]) }))
          for (const { key, sql } of statements) {
            const deleted = await executeObjectSQL(tab.connectionId, tab.database, sql, controller.signal)
            if (deleted.affectedRows !== 1) throw new Error('目标行已变化或不存在，请刷新后重试')
            removed.add(key)
          }
          const refreshed = await executeQuery(tab.connectionId, { database: tab.database, sql: adapter.tableDataSQL(tab.database, tab.table) }, controller.signal)
          if (!controller.signal.aborted) onResult(tab.id, refreshed)
        } catch (error) {
          if (!controller.signal.aborted) {
            if (removed.size) onResult(tab.id, { ...result, rows: result.rows.filter((_, index) => !removed.has(index)), rowCount: result.rows.length - removed.size })
            setDeletionError({ page: tab.id, detail: `已删除 ${removed.size} 行。` + (error instanceof Error ? error.message : '删除失败') + '；若请求中断，请刷新核对实际数据后再重试。' })
          }
        } finally {
          onDeleted()
          setCell(undefined)
          if (request.current === controller) {
            request.current = null
            setSaving(false)
            onBusyChange(tab.id, false)
          }
        }
      }
    })
  }
  return {
    rows: previewRows,
    deleteRows,
    deletionError: deletionError?.page === tab.id ? deletionError.detail : '',
    clearDeletionError: () => setDeletionError(undefined),
    newRows,
    newColumn: (key: number, index: number) => newRows.find((row) => row.key === key)?.columns.find((column) => column.name === result?.columns[index]?.name),
    canInsert: (column: Column | undefined) => Boolean(column && getDatabaseAdapter(connection?.type).canInsertColumn(column)),
    changeNew: (key: number, index: number, value: string | null | undefined) => {
      if (!blocked && !saving) setNewRows((previous) => previous.map((row) => (row.key === key ? { ...row, cells: row.cells.map((cell, column) => (column === index ? value : cell)) } : row)))
    },
    addRow,
    removeNewRow: (key: number) => {
      if (!saving) {
        setNewRows((previous) => previous.filter((row) => row.key !== key))
        if (cell?.row === key) setCell(undefined)
      }
    },
    cell,
    saving,
    begin,
    save,
    change,
    dirty,
    display: (row: number, column: number, original: unknown) => {
      const draft = drafts[row + ':' + column]
      return draft ? (draft.isNull ? null : draft.value) : original
    },
    isDirty: (row: number, column: number) => row < 0 || Boolean(drafts[row + ':' + column]),
    cancel: () => {
      if (!saving) {
        setCell(undefined)
        setDrafts({})
        setNewRows([])
      }
    },
    finish: () => {
      if (!saving) setCell(undefined)
    }
  }
}
