import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeOutlined,
  LoadingOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  TableOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { Alert, Button, Flex, Input, Table, theme, Typography } from 'antd'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ThHTMLAttributes } from 'react'

import ContentLoading from '@/components/contentLoading'
import DeleteDialog from '@/components/deleteDialog'
import EmptyStateIcon from '@/components/emptyStateIcon'
import ErrorNotice from '@/components/errorNotice'
import { usePageError } from '@/contexts/pageErrors'
import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { resultControlProps, resultSQLLayout, resultTableLayout, resultToolbarSpacing, workspaceEmptyStyle, workspaceInset } from '../../constant/layout'
import { useDataEditing } from '../../hooks/useDataEditing'
import { useResultTableScroll } from '../../hooks/useResultTableScroll'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { defaultOutputView, executionCancelled, pageExecutionError } from '../../utils/queryOutput'
import { exportResultRows, isNumericResultType, matchResultRows, resultTableRows, selectedResultRows, sortResultRows } from '../../utils/resultRows'
import type { ResultSort } from '../../utils/resultRows'
import DataCellEditor from '../dataCellEditor'
import NewRowCell from '../newRowCell'
import QueryMessages from '../queryMessages'
import QuerySummary from '../querySummary'
import ResultExport from '../resultExport'
import ResultsDock from '../resultsDock'
import ResultTabs from '../resultTabs'
import SQLPreview from '../sqlPreview'
import ToolbarButton from '../toolbarButton'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    | 'setTableDesignerDirty'
    | 'refreshResult'
    | 'canRefreshResult'
    | 'replayRequiresSession'
    | 'running'
    | 'setTableDesignerBusy'
    | 'replaceTableResult'
    | 'objects'
    | 'connections'
    | 'savedConnections'
    | 'result'
    | 'run'
    | 'runs'
    | 'activeRunning'
    | 'tab'
    | 'cancelQuery'
    | 'resultSearch'
    | 'setResultSearch'
    | 'resultIndex'
    | 'resultSetIndex'
    | 'selectResult'
    | 'resultHeight'
    | 'setResultHeight'
    | 'newQuery'
  >
}

const headerTextStyle = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } satisfies CSSProperties

/** 表头右边缘的列宽拖拽手柄与排序标题分离，点击手柄不触发排序。 */
function ColumnResizeHeaderCell({ className, children, ...cellProps }: ThHTMLAttributes<HTMLTableCellElement>) {
  const { t } = useTranslation()
  const resizable = className?.includes('data-resizable-header')
  return (
    <th className={className} {...cellProps}>
      {children}
      {resizable && (
        <span
          className="data-column-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('调整列宽')}
          tabIndex={0}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') event.stopPropagation()
          }}
        />
      )}
    </th>
  )
}

/** 展示当前页面的最新结果；表操作从对象树菜单发起，结果表使用虚拟滚动。 */
export default function QueryResults({ model, themeMode }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()

  const { result, run, activeRunning, tab, cancelQuery, resultSearch, setResultSearch, resultIndex, resultSetIndex, selectResult } = model
  const batch = model.runs[tab.id] ?? run
  const batchKey = batch?.startedAt ?? batch?.id
  usePageError(pageExecutionError(batch), batch?.id ?? batch?.startedAt)
  const editingBlocked = model.running || result?.truncatedBy === 'oversized-row' || model.objects.snapshots[tab.connectionId]?.status !== 'connected'
  const editing = useDataEditing({
    tab,
    connection: model.connections.find((item) => item.id === tab.connectionId),
    result,
    blocked: editingBlocked,
    onBusyChange: model.setTableDesignerBusy,
    onDirtyChange: model.setTableDesignerDirty,
    onResult: model.replaceTableResult
  })
  usePageError(editing.operationError, tab.id)
  const [selection, setSelection] = useState<{ result?: typeof result; keys: number[] }>({ keys: [] })
  const selectedRows = selection.result === result ? selection.keys : []
  const [deleteTarget, setDeleteTarget] = useState<{ result: typeof result; pageId: string; rows: number[]; table: string }>()
  const deletionPending = useRef(false)
  const currentDelete = deleteTarget?.pageId === tab.id ? deleteTarget : undefined
  const deletingRows = currentDelete && currentDelete.result === result ? currentDelete.rows : undefined
  const deleteError = currentDelete ? editing.deletionError : ''
  const rowDeletionDisabled = editingBlocked || Boolean(editing.dirty) || editing.saving

  function setDeleteOpen(open: boolean) {
    if (deletionPending.current) return
    editing.clearDeletionError()
    setDeleteTarget(open ? { result, pageId: tab.id, rows: [...selectedRows], table: `${tab.database}.${adapter?.tableLabel(tab.table) ?? tab.table}` } : undefined)
  }

  async function confirmDelete() {
    if (!deletingRows?.length || rowDeletionDisabled || deletionPending.current) return
    deletionPending.current = true
    try {
      if (await editing.deleteRows(deletingRows, () => setSelection({ keys: [] }))) setDeleteTarget(undefined)
    } finally {
      deletionPending.current = false
    }
  }
  const [sorting, setSorting] = useState<{ result?: typeof result; sort?: ResultSort }>({})
  const sort = sorting.result === result ? sorting.sort : undefined
  const columnSizingKey = `${run?.id ?? ''}:${resultIndex}:${result?.columns.length ?? 0}`
  const [columnSizing, setColumnSizing] = useState<{ key: string; widths: Record<number, number> }>({ key: '', widths: {} })
  const columnWidths = columnSizing.key === columnSizingKey ? columnSizing.widths : {}
  const columnResizeCleanup = useRef<() => void>(undefined)
  useEffect(() => () => columnResizeCleanup.current?.(), [columnSizingKey])

  function measureColumnWidths() {
    if (columnSizing.key === columnSizingKey) return columnWidths
    // 固定拖拽起始时的各列宽度，避免虚拟表格继续摊分视口余量。
    const cells = viewport.current?.querySelectorAll<HTMLElement>('.ant-table-thead th.data-resizable-header')
    return Object.fromEntries(Array.from(cells ?? [], (cell, position) => [position, Math.round(cell.getBoundingClientRect().width)]))
  }

  function setColumnWidth(index: number, width: number, measured: Record<number, number>) {
    setColumnSizing((previous) => {
      const widths = previous.key === columnSizingKey ? previous.widths : measured
      return { key: columnSizingKey, widths: { ...widths, [index]: width } }
    })
  }

  function startColumnResize(event: ReactPointerEvent<HTMLTableCellElement>, index: number) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    columnResizeCleanup.current?.()
    const element = viewport.current
    const measured = measureColumnWidths()
    const startWidth = event.currentTarget.getBoundingClientRect().width
    const startX = event.clientX
    const pointerId = event.pointerId
    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      setColumnWidth(index, Math.max(resultTableLayout.minColumnWidth, Math.round(startWidth + moveEvent.clientX - startX)), measured)
    }
    const stop = (endEvent?: PointerEvent) => {
      if (endEvent && endEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      element?.style.removeProperty('cursor')
      element?.style.removeProperty('user-select')
      columnResizeCleanup.current = undefined
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    columnResizeCleanup.current = stop
    if (element) {
      element.style.cursor = 'col-resize'
      element.style.userSelect = 'none'
    }
  }

  function nudgeColumn(event: ReactKeyboardEvent<HTMLTableCellElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const currentWidth = event.currentTarget.getBoundingClientRect().width
    setColumnWidth(index, Math.max(resultTableLayout.minColumnWidth, Math.round(currentWidth + (event.key === 'ArrowRight' ? 16 : -16))), measureColumnWidths())
  }
  const [selectedView, setSelectedView] = useState<{
    pageId: string
    batchKey?: string
    view: 'messages' | 'summary'
  } | null>(null)
  // 批次内的逐条回执共享同一视图；重新执行后按新批次选择默认视图。
  const view = selectedView?.pageId === tab.id && selectedView.batchKey === batchKey ? selectedView.view : null
  const activeKey = view ?? (run ? defaultOutputView(run, resultIndex, activeRunning, resultSetIndex) : 'messages')
  const showingResult = activeKey !== 'messages' && activeKey !== 'summary'
  const hasTable = Boolean(result?.columns.length)
  const databaseType = model.savedConnections.find((connection) => connection.id === tab.connectionId)?.type
  const adapter = databaseType === DatabaseEngine.Redis ? undefined : getDatabaseAdapter(databaseType)
  const { viewport, bodyHeight } = useTableViewportLayout(`${run?.id}:${activeKey}:${hasTable}:${activeRunning}`)
  const table = useResultTableScroll({ result, runId: run?.id, view, search: resultSearch, sortKey: sort ? `${sort.column}:${sort.order}` : '', added: editing.newRows.length })
  const deferredSearch = useDeferredValue(resultSearch)
  const matches = useMemo(() => (showingResult ? matchResultRows(editing.rows, deferredSearch) : null), [editing.rows, deferredSearch, showingResult])
  const sortType = sort ? result?.columns[sort.column]?.type : undefined
  const orderedMatches = useMemo(
    () => (showingResult ? sortResultRows(result?.rows ?? editing.rows, matches, sort, sortType) : null),
    [result?.rows, editing.rows, matches, sort, sortType, showingResult]
  )
  const rowCount = editing.newRows.length + (matches?.length ?? editing.rows.length)
  const rows = useMemo(() => (showingResult ? resultTableRows(editing.rows, editing.newRows, orderedMatches) : []), [editing.rows, editing.newRows, orderedMatches, showingResult])
  const columns = [
    {
      title: '#',
      key: 'index',
      width: resultTableLayout.indexWidth,
      fixed: 'left' as const,
      align: 'right' as const,
      className: 'cell-index',
      onHeaderCell: () => ({ style: { verticalAlign: 'top' } }),
      render: (
        _: unknown,
        row: {
          key: number
        }
      ) => (row.key < 0 ? <ToolbarButton label={t('移除新增行')} icon={<CloseOutlined />} disabled={editingBlocked} onClick={() => editing.removeNewRow(row.key)} /> : row.key + 1)
    },
    ...(result?.columns || []).map((column, index) => {
      const numeric = isNumericResultType(column.type ?? '')
      const name = run?.kind === 'structure' ? t(column.name) : column.name
      const lastColumn = index === (result?.columns.length ?? 0) - 1
      const defaultWidth = run?.kind === 'ddl' || lastColumn ? undefined : adapter?.isSQLColumn(column.name) ? resultSQLLayout.columnWidth : numeric ? 140 : 220
      return {
        title: (
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2, textAlign: 'start' }}>
            <span title={name} style={headerTextStyle}>
              {name}
            </span>
            {column.type && (
              <Typography.Text type="secondary" title={column.type} style={headerTextStyle}>
                {column.type}
              </Typography.Text>
            )}
          </span>
        ),
        key: String(index),
        sorter: true,
        sortOrder: sort?.column === index ? sort.order : null,
        onHeaderCell: () => ({
          className: 'data-resizable-header',
          onPointerDown: (event: ReactPointerEvent<HTMLTableCellElement>) => {
            if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('data-column-resizer')) return
            startColumnResize(event, index)
          },
          onKeyDown: (event: ReactKeyboardEvent<HTMLTableCellElement>) => {
            if (!(event.target instanceof HTMLElement) || !event.target.classList.contains('data-column-resizer')) return
            nudgeColumn(event, index)
          }
        }),
        onCell: (row: { key: number }) => ({
          className: editing.isDirty(row.key, index) ? 'data-cell-dirty' : undefined,
          style: numeric ? { fontVariantNumeric: 'tabular-nums' } : undefined,
          onDoubleClick: () => {
            if (tab.kind === 'data' && adapter?.dataEditing && row.key >= 0) void editing.begin(row.key, index)
          }
        }),
        width: columnWidths[index] ?? defaultWidth,
        render: (
          _: unknown,
          row: {
            key: number
            cells: unknown[]
          }
        ) =>
          row.key < 0 ? (
            <NewRowCell
              value={row.cells[index]}
              column={editing.newColumn(row.key, index)}
              editable={editing.canInsert(editing.newColumn(row.key, index))}
              disabled={editingBlocked}
              onChange={(value) => editing.changeNew(row.key, index, value)}
            />
          ) : editing.cell?.row === row.key && editing.cell.column === index ? (
            <DataCellEditor editor={editing} disabled={editingBlocked} />
          ) : adapter?.isSQLColumn(column.name) && typeof row.cells[index] === 'string' && String(row.cells[index]).trim() ? (
            <div style={{ minWidth: 0, width: run?.kind === 'ddl' ? undefined : resultSQLLayout.columnWidth, maxWidth: '100%' }}>
              <SQLPreview compact sql={String(row.cells[index])} themeMode={themeMode} databaseType={databaseType} />
            </div>
          ) : row.cells[index] === null ? (
            <Typography.Text style={{ color: token.colorTextSecondary, fontStyle: 'italic' }} type="secondary">
              (NULL)
            </Typography.Text>
          ) : (
            <span
              className={run?.kind === 'structure' && column.name === '表名' ? 'database-object-name' : undefined}
              style={run?.kind === 'structure' && column.name === '表名' ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}
            >
              {run?.kind === 'structure' &&
                column.name === '表名' &&
                (String(row.cells[result?.columns.findIndex((item) => item.name === '类型') ?? -1]).includes('VIEW') ? <EyeOutlined /> : <TableOutlined />)}
              <span
                className="cell-value"
                title={row.cells[index] === undefined ? t('使用默认值') : String(row.cells[index])}
                style={{ display: 'block', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {row.cells[index] === undefined ? t('(默认)') : String(row.cells[index])}
              </span>
            </span>
          )
      }
    })
  ]
  const scrollWidth = columns.reduce<number>((total, column) => total + (column.width ?? resultTableLayout.columnWidth), resultTableLayout.selectionWidth)
  const columnsSized = Object.keys(columnWidths).length > 0
  const shownOutput = showingResult ? run : batch
  const stopped = shownOutput ? executionCancelled(shownOutput) || Boolean(shownOutput.interrupted) : false
  const failed = !stopped && Boolean(shownOutput?.error)
  const statement = batch?.statements?.[resultIndex]
  const durationMs = failed
    ? (statement?.error === shownOutput?.error ? statement?.durationMs : undefined) ?? shownOutput?.durationMs
    : result?.durationMs ?? statement?.durationMs ?? shownOutput?.durationMs
  const status = activeRunning
    ? { icon: <LoadingOutlined spin />, label: t('执行中'), color: token.colorTextSecondary }
    : stopped
      ? { icon: <StopOutlined />, label: t(shownOutput?.interrupted ? '执行已中断' : '执行已取消'), color: token.colorTextSecondary }
      : failed
        ? { icon: <CloseCircleOutlined />, label: t('失败'), color: token.colorError }
        : result
          ? { icon: <CheckCircleOutlined />, label: t('成功'), color: token.colorSuccess }
          : undefined
  const resultStatus = status && (
    <Flex align="center" style={{ whiteSpace: 'nowrap' }}>
      {!activeRunning && !stopped && durationMs !== undefined && (
        <Typography.Text type="secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {durationMs} ms
        </Typography.Text>
      )}
      <span
        role="img"
        aria-label={status.label}
        title={status.label}
        style={{ display: 'inline-grid', placeItems: 'center', flex: 'none', inlineSize: token.controlHeight, blockSize: token.controlHeight, color: status.color }}
      >
        {status.icon}
      </span>
      {(activeRunning || stopped) && (
        <Typography.Text type="secondary" aria-hidden="true">
          {status.label}
        </Typography.Text>
      )}
    </Flex>
  )
  if (!run) return null
  const output = batch ?? run
  return (
    <ResultsDock resizable={tab.kind === 'query'} height={model.resultHeight} onHeightChange={model.setResultHeight}>
      {run.interrupted && <Alert type="warning" banner title={t('上次执行因页面刷新中断，已完成结果保留；未自动继续执行。')} />}
      <div className="result-bars" style={{ flex: 'none' }}>
        <ResultTabs
          run={output}
          running={activeRunning}
          activeKey={activeKey}
          status={resultStatus}
          onChange={(key) => {
            if (key === 'messages' || key === 'summary') setSelectedView({ pageId: tab.id, batchKey, view: key })
            else {
              const [index, setIndex = '0'] = key.split(':')
              selectResult(Number(index), Number(setIndex))
              setSelectedView(null)
            }
          }}
        />
        {(showingResult || (activeRunning && tab.kind !== 'query')) && (
          <Flex
            className="result-toolbar"
            align="center"
            justify="space-between"
            wrap
            style={{
              ...resultToolbarSpacing,
              paddingInline: workspaceInset,
              borderBlockEnd: `${token.lineWidth}px solid var(--layout-divider)`
            }}
          >
            {tab.kind !== 'data' && showingResult && (
              <Flex className="result-meta" align="center" gap={token.marginXXS} style={{ color: token.colorTextSecondary, fontVariantNumeric: 'tabular-nums' }}>
                <CheckCircleOutlined />
                {t('已选择 {value1} 行', { value1: selectedRows.length })}
              </Flex>
            )}
            <Flex className="result-actions" align="center" justify="end" gap={resultToolbarSpacing.gap} wrap style={{ minWidth: 0, maxWidth: '100%' }}>
              {showingResult && (
                <Input
                  {...resultControlProps}
                  className="result-filter"
                  prefix={<SearchOutlined />}
                  placeholder={t('筛选当前结果')}
                  aria-label={t('筛选查询结果')}
                  value={resultSearch}
                  onChange={(event) => setResultSearch(event.target.value)}
                  allowClear
                  disabled={!result || result.truncatedBy === 'oversized-row'}
                />
              )}
              <Flex role="group" aria-label={t('结果操作')} align="center" justify="end" gap={token.marginXXS} wrap>
                {tab.kind === 'data' && adapter?.dataEditing && (
                  <>
                    <ToolbarButton
                      label={t('新增行')}
                      icon={<PlusOutlined />}
                      disabled={editingBlocked}
                      onClick={() => {
                        setResultSearch('')
                        void editing.addRow()
                      }}
                    />
                    <ToolbarButton
                      label={t('删除行')}
                      icon={<DeleteOutlined />}
                      danger
                      disabled={rowDeletionDisabled || !selectedRows.length}
                      hint={editing.dirty ? t('请先保存或放弃修改') : t('删除选中的数据行')}
                      aria-haspopup="dialog"
                      onClick={() => setDeleteOpen(true)}
                    />
                    <ToolbarButton
                      label={t('保存')}
                      icon={<SaveOutlined />}
                      loading={editing.saving}
                      disabled={editingBlocked || !editing.dirty}
                      onClick={() => {
                        void editing.save()
                      }}
                    />
                    <ToolbarButton label={t('放弃修改')} icon={<UndoOutlined />} disabled={editingBlocked || !editing.dirty} onClick={editing.cancel} />
                  </>
                )}
                <ToolbarButton
                  label={tab.kind === 'query' ? t('重新执行') : t('刷新')}
                  icon={<ReloadOutlined />}
                  loading={activeRunning}
                  disabled={model.running || !model.canRefreshResult || Boolean(editing.dirty)}
                  hint={
                    model.replayRequiresSession
                      ? t('单条重跑无法还原批次会话，请在编辑器中核对原脚本')
                      : editing.dirty
                        ? t('请先保存或放弃修改')
                        : tab.kind === 'query'
                          ? t('重新执行当前结果对应的 SQL，写入语句也会再次执行')
                          : t('刷新当前结果')
                  }
                  onClick={model.refreshResult}
                />
                {tab.kind !== 'query' && activeRunning && <ToolbarButton label={t('取消执行')} icon={<StopOutlined />} danger onClick={cancelQuery} />}
                {showingResult && (
                  <ResultExport
                    key={tab.id}
                    result={result}
                    selectedCount={selectedRows.length}
                    disabled={deferredSearch !== resultSearch}
                    rows={(selected) => (selected ? selectedResultRows(editing.rows, selectedRows, sort, sortType, result?.rows) : exportResultRows(editing.rows, editing.newRows, orderedMatches))}
                  />
                )}
              </Flex>
            </Flex>
          </Flex>
        )}
      </div>
      {showingResult && !activeRunning && (statement?.result ?? batch?.result)?.resultSetsTruncated && (
        <Alert type="warning" banner title={t('语句返回的结果超过 8 MiB，部分结果集未加载。')} />
      )}
      {showingResult && !activeRunning && result?.truncated && (
        <Alert
          type="warning"
          banner
          title={t(
            result.truncatedBy === 'oversized-row'
              ? '首行超过 8 MiB，仅提供只读预览。'
              : result.truncatedBy === 'byte-limit'
                ? '结果超过 8 MiB，仅显示已返回的完整行。'
                : result.truncatedBy === 'row-limit'
                  ? '结果已达行数上限，仅显示已返回的行。'
                  : '结果已达行数或大小上限，请收窄查询范围。'
          )}
        />
      )}
      <div
        ref={viewport}
        className="result-scroll"
        tabIndex={0}
        aria-label={t('结果数据滚动区域')}
        aria-busy={editing.saving}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', minWidth: 0 }}
      >
        {editing.saving && <ContentLoading label={t('正在保存并刷新数据…')} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--surface)' }} />}
        {activeKey === 'messages' ? (
          <QueryMessages key={`${tab.id}:${batchKey}`} run={output} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeKey === 'summary' ? (
          <QuerySummary key={`${tab.id}:${batchKey}`} run={output} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeRunning ? (
          <ContentLoading label={t('正在加载结果…')} />
        ) : result?.rowPreview?.length ? (
          <div style={{ padding: workspaceInset, overflow: 'auto', maxHeight: '100%' }}>
            {result.rowPreview.map(({ value, shortened }, index) => (
              <Typography.Paragraph key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                <Typography.Text strong>{result.columns[index]?.name}</Typography.Text>
                <br />
                {value === null ? 'NULL' : value}
                {shortened && '…'}
              </Typography.Paragraph>
            ))}
          </div>
        ) : result ? (
          <Table
            style={{ visibility: editing.saving ? 'hidden' : undefined, width: columnsSized ? scrollWidth : undefined, maxWidth: '100%' }}
            ref={table}
            virtual
            className={`data-table${columnsSized ? ' data-table-sized' : ''}`}
            components={{ header: { cell: ColumnResizeHeaderCell } }}
            showSorterTooltip={{ title: t('对当前已加载的结果排序'), target: 'sorter-icon' }}
            styles={{ header: { cell: { paddingBlock: token.paddingXXS } }, body: { cell: { paddingBlock: token.paddingXXS } } }}
            tableLayout={run.kind === 'ddl' || columnsSized ? 'fixed' : undefined}
            rowSelection={{
              columnWidth: resultTableLayout.selectionWidth,
              selectedRowKeys: selectedRows,
              onChange: (keys) => setSelection({ result, keys: keys.filter((key): key is number => typeof key === 'number') }),
              preserveSelectedRowKeys: true,
              getCheckboxProps: (row) => ({ disabled: model.running || row.key < 0 })
            }}
            onChange={(_, __, sorter) => {
              const selected = Array.isArray(sorter) ? sorter[0] : sorter
              const column = Number(selected.columnKey)
              setSorting({ result, sort: selected.order && Number.isInteger(column) ? { column, order: selected.order } : undefined })
            }}
            columns={columns}
            dataSource={rows}
            pagination={false}
            scroll={{ x: scrollWidth, y: bodyHeight || 24 }}
            locale={{ emptyText: result.isQuery ? t('查询成功，没有匹配的数据') : t('语句执行成功，影响 {value1} 行', { value1: result.affectedRows }) }}
          />
        ) : (
          <div style={{ ...workspaceEmptyStyle, minHeight: 180 }}>
            <EmptyStateIcon>
              <TableOutlined />
            </EmptyStateIcon>
            <Typography.Text type="secondary">{t('暂无结果')}</Typography.Text>
            <Button icon={<PlusOutlined />} disabled={model.running} onClick={model.newQuery}>
              {t('新建查询')}
            </Button>
            {databaseType !== DatabaseEngine.Redis && <Typography.Text type="secondary">{t('从左侧选择表')}</Typography.Text>}
          </div>
        )}
      </div>
      {showingResult && !activeRunning && result && hasTable && result.truncatedBy !== 'oversized-row' && (
        <Typography.Text
          type="secondary"
          style={{ flex: 'none', textAlign: 'end', paddingBlock: token.paddingXS, paddingInline: workspaceInset, borderBlockStart: `${token.lineWidth}px solid var(--layout-divider)` }}
        >
          {t('共 {count} 条', { count: rowCount })}
        </Typography.Text>
      )}
      <DeleteDialog
        title={deleteError ? t('删除结果') : t('删除选中的 {value1} 行数据？', { value1: currentDelete?.rows.length ?? 0 })}
        open={Boolean(deletingRows?.length || deleteError)}
        busy={editing.saving}
        disabled={rowDeletionDisabled || !deletingRows?.length}
        resultOnly={Boolean(deleteError)}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
      >
        <Typography.Paragraph strong>{currentDelete?.table}</Typography.Paragraph>
        {deleteError ? (
          <ErrorNotice error={deleteError} />
        ) : (
          <>
            <Typography.Paragraph>{t('删除立即生效，遇到失败会停止。')}</Typography.Paragraph>
            <Typography.Text type="secondary">{t('无主键时按原始整行匹配。完全相同的记录每选中一条只删除一条。')}</Typography.Text>
          </>
        )}
      </DeleteDialog>
    </ResultsDock>
  )
}
