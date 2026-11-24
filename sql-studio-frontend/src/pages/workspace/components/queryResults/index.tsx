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
import { Alert, Button, Flex, Input, Space, Table, theme, Typography } from 'antd'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ThHTMLAttributes } from 'react'

import ContentLoading from '@/components/contentLoading'
import DeleteDialog from '@/components/deleteDialog'
import EmptyStateIcon from '@/components/emptyStateIcon'
import ErrorNotice from '@/components/errorNotice'
import { appearance } from '@/constant/appearance'
import { usePageError } from '@/contexts/pageErrors'
import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { resultSQLLayout, resultTableLayout, resultToolbarIconInset, workspaceEmptyStyle } from '../../constant/layout'
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

  const { result, run, activeRunning, tab, cancelQuery, resultSearch, setResultSearch, resultIndex, selectResult } = model
  const batch = model.runs[tab.id] ?? run
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

  function setColumnWidth(index: number, width: number) {
    const lastIndex = (result?.columns.length ?? 0) - 1
    const widths = { ...columnWidths, [index]: width }
    // 首次拖拽其他列时固定最后一列的实际宽度，避免自动伸展突然回落到默认值。
    if (lastIndex >= 0 && index !== lastIndex && widths[lastIndex] === undefined) {
      const lastCell = viewport.current?.querySelectorAll<HTMLElement>('.ant-table-thead th.data-resizable-header')[lastIndex]
      const measured = lastCell?.getBoundingClientRect().width
      if (measured) widths[lastIndex] = Math.max(resultTableLayout.minColumnWidth, Math.round(measured))
    }
    setColumnSizing({ key: columnSizingKey, widths })
  }

  function startColumnResize(event: ReactPointerEvent<HTMLTableCellElement>, index: number) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const startWidth = event.currentTarget.getBoundingClientRect().width
    const startX = event.clientX
    const handleMove = (moveEvent: PointerEvent) => {
      setColumnWidth(index, Math.max(resultTableLayout.minColumnWidth, Math.round(startWidth + moveEvent.clientX - startX)))
    }
    const stop = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      viewport.current?.style.removeProperty('cursor')
      viewport.current?.style.removeProperty('user-select')
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    if (viewport.current) {
      viewport.current.style.cursor = 'col-resize'
      viewport.current.style.userSelect = 'none'
    }
  }

  function nudgeColumn(event: ReactKeyboardEvent<HTMLTableCellElement>, index: number) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    const currentWidth = event.currentTarget.getBoundingClientRect().width
    setColumnWidth(index, Math.max(resultTableLayout.minColumnWidth, Math.round(currentWidth + (event.key === 'ArrowRight' ? 16 : -16))))
  }
  const [selectedView, setSelectedView] = useState<{
    pageId: string
    runId?: string
    view: 'messages' | 'summary'
  } | null>(null)
  // 消息/摘要选择只属于当前这次输出；新输出立即回到工作区选中的最新结果。
  const view = selectedView?.pageId === tab.id && selectedView.runId === run?.id ? selectedView.view : null
  const activeKey = view ?? (run ? defaultOutputView(run, resultIndex, activeRunning) : 'messages')
  const showingResult = activeKey !== 'messages' && activeKey !== 'summary'
  const hasTable = Boolean(result?.columns.length)
  const databaseType = model.savedConnections.find((connection) => connection.id === tab.connectionId)?.type
  const adapter = databaseType === DatabaseEngine.Redis ? undefined : getDatabaseAdapter(databaseType)
  const { viewport, bodyHeight } = useTableViewportLayout(`${run?.id}:${view}`)
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
      ) => (row.key < 0 ? <ToolbarButton label={t('移除新增行')} size="small" icon={<CloseOutlined />} disabled={editingBlocked} onClick={() => editing.removeNewRow(row.key)} /> : row.key + 1)
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
  const shownOutput = showingResult ? run : batch
  const stopped = shownOutput ? executionCancelled(shownOutput) || Boolean(shownOutput.interrupted) : false
  const failed = !stopped && Boolean(shownOutput?.error)
  const durationMs = result?.durationMs ?? batch?.statements?.[resultIndex]?.durationMs
  const status = activeRunning
    ? { icon: <LoadingOutlined spin />, label: t('执行中'), color: token.colorTextSecondary }
    : stopped
      ? { icon: <StopOutlined />, label: t(shownOutput?.interrupted ? '执行已中断' : '执行已取消'), color: token.colorTextSecondary }
      : failed
        ? { icon: <CloseCircleOutlined />, label: t('失败'), color: token.colorErrorText }
        : result
          ? { icon: <CheckCircleOutlined />, label: t('成功'), color: token.colorSuccessText }
          : undefined
  const showMetrics = !activeRunning && !stopped && !failed
  const resultStatus = status && (
    <Flex align="center" gap={token.marginXS} wrap>
      <Space size={token.marginXXS} style={{ color: status.color, whiteSpace: 'nowrap' }}>
        {status.icon}
        {status.label}
      </Space>
      {showMetrics && (durationMs !== undefined || result?.columns.length || result?.isQuery) ? (
        <Space size={token.marginXXS} separator={<Typography.Text type="secondary">·</Typography.Text>} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {durationMs !== undefined && <Typography.Text type="secondary">{durationMs} ms</Typography.Text>}
          {result?.isQuery && <Typography.Text type="secondary">{t('{value1} 行', { value1: result.rows.length })}</Typography.Text>}
          {Boolean(result?.columns.length) && <Typography.Text type="secondary">{t('{value1} 列', { value1: result?.columns.length ?? 0 })}</Typography.Text>}
        </Space>
      ) : null}
    </Flex>
  )
  if (!run) return null
  return (
    <ResultsDock resizable={tab.kind === 'query'} height={model.resultHeight} onHeightChange={model.setResultHeight}>
      {run.interrupted && <Alert type="warning" banner title={t('上次执行因页面刷新中断，已完成结果保留；未自动继续执行。')} />}
      <ResultTabs
        run={run}
        running={activeRunning}
        activeKey={activeKey}
        status={resultStatus}
        onChange={(key) => {
          if (key === 'messages' || key === 'summary') setSelectedView({ pageId: tab.id, runId: run.id, view: key })
          else {
            selectResult(Number(key))
            setSelectedView(null)
          }
        }}
      />
      {(showingResult || (activeRunning && tab.kind !== 'query')) && (
        <div
          className="result-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            minHeight: 38,
            padding: '0 var(--workspace-inset)',
            borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
            flex: 'none'
          }}
        >
          <div className="result-meta" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: '1 0 auto', flexWrap: 'wrap' }}>
            {tab.kind !== 'data' && showingResult && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, paddingInlineStart: resultToolbarIconInset, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                <CheckCircleOutlined />
                {t('已选择 {value1} 行', { value1: selectedRows.length })}
              </span>
            )}
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
          </div>
          <div className="result-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 1 auto', minWidth: 0, marginInlineStart: 'auto' }}>
            {showingResult && (
              <Input
                style={{ width: 160, flex: '0 1 160px', minWidth: 0 }}
                prefix={<SearchOutlined />}
                placeholder={t('筛选当前结果')}
                aria-label={t('筛选查询结果')}
                value={resultSearch}
                onChange={(event) => {
                  setResultSearch(event.target.value)
                }}
                allowClear
                disabled={!result || result.truncatedBy === 'oversized-row'}
              />
            )}
            <div role="group" aria-label={t('结果操作')} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <ToolbarButton
                label={tab.kind === 'query' ? t('重新执行') : t('刷新')}
                icon={<ReloadOutlined />}
                loading={activeRunning}
                disabled={model.running || !model.canRefreshResult || Boolean(editing.dirty)}
                hint={editing.dirty ? t('请先保存或放弃修改') : tab.kind === 'query' ? t('重新执行当前结果对应的 SQL，写入语句也会再次执行') : t('刷新当前结果')}
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
            </div>
          </div>
        </div>
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
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: showingResult ? 'hidden' : 'auto', minWidth: 0 }}
      >
        {editing.saving && <ContentLoading label={t('正在保存并刷新数据…')} style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--surface)' }} />}
        {activeKey === 'messages' ? (
          <QueryMessages key={tab.id} run={batch ?? run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeKey === 'summary' ? (
          <QuerySummary key={run.id} run={batch ?? run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeRunning ? (
          <ContentLoading label={t('正在加载结果…')} />
        ) : result?.rowPreview?.length ? (
          <div style={{ padding: 'var(--workspace-inset)', overflow: 'auto', maxHeight: '100%' }}>
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
          <>
            <Table
              style={{ visibility: editing.saving ? 'hidden' : undefined }}
              ref={table}
              virtual
              size={appearance.tableSize}
              className={`data-table${Object.keys(columnWidths).length ? ' data-table-sized' : ''}`}
              components={{ header: { cell: ColumnResizeHeaderCell } }}
              showSorterTooltip={{ title: t('对当前已加载的结果排序'), target: 'sorter-icon' }}
              styles={{ header: { cell: { paddingBlock: token.paddingXXS } }, body: { cell: { paddingBlock: token.paddingXXS } } }}
              tableLayout={run.kind === 'ddl' ? 'fixed' : undefined}
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
          </>
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
          style={{ flex: 'none', textAlign: 'end', paddingBlock: token.paddingXS, paddingInline: token.padding, borderBlockStart: `${token.lineWidth}px solid ${token.colorBorderSecondary}` }}
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
