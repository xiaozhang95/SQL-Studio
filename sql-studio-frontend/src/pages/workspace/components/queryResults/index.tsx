import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  DownOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  StopOutlined,
  TableOutlined,
  UndoOutlined
} from '@ant-design/icons'
import { Alert, Button, Dropdown, Empty, Input, Pagination, Table, Typography } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'

import ContentLoading from '@/components/contentLoading'
import { appearance } from '@/constant/appearance'
import { tablePaginationDefaults } from '@/constant/tablePagination'
import { getDatabaseAdapter } from '@/databases'
import type { ThemeMode } from '@/typings/theme'
import { exportCSV } from '@/utils/csv'

import { resultSQLLayout, resultTableLayout } from '../../constant/layout'
import { useDataEditing } from '../../hooks/useDataEditing'
import { useResultTableScroll } from '../../hooks/useResultTableScroll'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { defaultOutputView } from '../../utils/queryOutput'
import { exportResultRows, matchResultRows, pageResultRows, selectedResultRows, sortResultRows } from '../../utils/resultRows'
import type { ResultSort } from '../../utils/resultRows'
import DataCellEditor from '../dataCellEditor'
import NewRowCell from '../newRowCell'
import QueryMessages from '../queryMessages'
import QuerySummary from '../querySummary'
import ResultsDock from '../resultsDock'
import ResultTabs from '../resultTabs'
import SQLPreview from '../sqlPreview'

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
    | 'result'
    | 'run'
    | 'activeRunning'
    | 'tab'
    | 'cancelQuery'
    | 'resultSearch'
    | 'setResultSearch'
    | 'tablePage'
    | 'setTablePage'
    | 'resultIndex'
    | 'selectResult'
    | 'resultHeight'
    | 'setResultHeight'
  >
}
/** 展示当前页面的最新结果；表操作从对象树菜单发起，分页独立于滚动内容。 */
export default function QueryResults({ model, themeMode }: Props) {
  const { result, run, activeRunning, tab, cancelQuery, resultSearch, setResultSearch, tablePage, setTablePage, resultIndex, selectResult } = model
  const editingBlocked = model.running || model.objects.snapshots[tab.connectionId]?.status !== 'connected'
  const editing = useDataEditing({
    tab,
    connection: model.connections.find((item) => item.id === tab.connectionId),
    result,
    blocked: editingBlocked,
    onBusyChange: model.setTableDesignerBusy,
    onDirtyChange: model.setTableDesignerDirty,
    onResult: model.replaceTableResult
  })
  const [selection, setSelection] = useState<{ result?: typeof result; keys: number[] }>({ keys: [] })
  const selectedRows = selection.result === result ? selection.keys : []
  const [sorting, setSorting] = useState<{ result?: typeof result; sort?: ResultSort }>({})
  const sort = sorting.result === result ? sorting.sort : undefined
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
  const databaseType = model.connections.find((connection) => connection.id === tab.connectionId)?.type
  const adapter = getDatabaseAdapter(databaseType)
  const { viewport, bodyHeight } = useTableViewportLayout(`${run?.id}:${view}`)
  const table = useResultTableScroll({ result, runId: run?.id, view, page: tablePage, search: resultSearch, sortKey: sort ? `${sort.column}:${sort.order}` : '', added: editing.newRows.length })
  const deferredSearch = useDeferredValue(resultSearch)
  const matches = useMemo(() => (showingResult ? matchResultRows(editing.rows, deferredSearch) : null), [editing.rows, deferredSearch, showingResult])
  const sortType = sort ? result?.columns[sort.column]?.type : undefined
  const orderedMatches = useMemo(
    () => (showingResult ? sortResultRows(result?.rows ?? editing.rows, matches, sort, sortType) : null),
    [result?.rows, editing.rows, matches, sort, sortType, showingResult]
  )
  const rowCount = editing.newRows.length + (matches?.length ?? editing.rows.length)
  const rows = useMemo(() => (showingResult ? pageResultRows(editing.rows, editing.newRows, orderedMatches, tablePage) : []), [editing.rows, editing.newRows, orderedMatches, tablePage, showingResult])
  const columns = [
    {
      title: '#',
      key: 'index',
      width: resultTableLayout.indexWidth,
      fixed: 'left' as const,
      render: (
        _: unknown,
        row: {
          key: number
        }
      ) => (row.key < 0 ? <Button type="text" size="small" icon={<CloseOutlined />} aria-label="移除新增行" disabled={editingBlocked} onClick={() => editing.removeNewRow(row.key)} /> : row.key + 1)
    },
    ...(result?.columns || []).map((column, index) => ({
      title: (
        <div className="column-title" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          {column.name}
          {column.type && (
            <Typography.Text className="column-type" type="secondary">
              {column.type}
            </Typography.Text>
          )}
        </div>
      ),
      key: String(index),
      sorter: true,
      sortOrder: sort?.column === index ? sort.order : null,
      showSorterTooltip: { title: '对当前已加载的结果排序' },
      onCell: (row: { key: number }) => ({
        className: editing.isDirty(row.key, index) ? 'data-cell-dirty' : undefined,
        onDoubleClick: () => {
          if (tab.kind === 'data' && row.key >= 0) void editing.begin(row.key, index)
        }
      }),
      width: run?.kind === 'ddl' ? undefined : adapter.isSQLColumn(column.name) ? resultSQLLayout.columnWidth : resultTableLayout.columnWidth,
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
        ) : adapter.isSQLColumn(column.name) && typeof row.cells[index] === 'string' && String(row.cells[index]).trim() ? (
          <div style={{ minWidth: 0, width: run?.kind === 'ddl' ? undefined : resultSQLLayout.columnWidth, maxWidth: '100%' }}>
            <SQLPreview compact sql={String(row.cells[index])} themeMode={themeMode} databaseType={databaseType} />
          </div>
        ) : row.cells[index] === null ? (
          <Typography.Text className="cell-null" type="secondary">
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
              title={row.cells[index] === undefined ? '使用默认值' : String(row.cells[index])}
              style={{ display: 'block', maxWidth: 520, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {row.cells[index] === undefined ? '(默认)' : String(row.cells[index])}
            </span>
          </span>
        )
    }))
  ]
  const scrollWidth = columns.reduce<number>((total, column) => total + (column.width ?? 0), resultTableLayout.selectionWidth)
  if (!run) return null
  return (
    <ResultsDock resizable={tab.kind === 'query'} height={model.resultHeight} onHeightChange={model.setResultHeight}>
      {run.interrupted && <Alert type="warning" banner title="上次执行因页面刷新中断，已完成结果保留；未自动继续执行。" />}
      {editing.deletionError && <Alert type="error" showIcon closable onClose={editing.clearDeletionError} title="删除数据未完成" description={editing.deletionError} />}
      <ResultTabs
        run={run}
        running={activeRunning}
        activeKey={activeKey}
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
            padding: '8px var(--workspace-inset)',
            borderBottom: '1px solid var(--border)',
            flex: 'none'
          }}
        >
          <div className="result-meta" style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: '1 0 auto', flexWrap: 'wrap' }}>
            {tab.kind === 'data' && (
              <>
                <Button
                  icon={<PlusOutlined />}
                  disabled={editingBlocked}
                  onClick={() => {
                    setResultSearch('')
                    setTablePage(1)
                    void editing.addRow()
                  }}
                >
                  新增行
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  disabled={editingBlocked || Boolean(editing.dirty) || !selectedRows.length}
                  title={editing.dirty ? '请先保存或放弃修改' : '删除选中的数据行'}
                  onClick={() => editing.deleteRows(selectedRows, () => setSelection({ keys: [] }))}
                >
                  删除行
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  type="primary"
                  loading={editing.saving}
                  disabled={editingBlocked || !editing.dirty}
                  onClick={() => {
                    setTablePage(1)
                    void editing.save()
                  }}
                >
                  保存
                </Button>
                <Button icon={<UndoOutlined />} disabled={editingBlocked || !editing.dirty} onClick={editing.cancel}>
                  放弃修改
                </Button>
              </>
            )}
          </div>
          <div className="result-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <Button
              icon={<ReloadOutlined />}
              loading={activeRunning}
              disabled={model.running || !model.canRefreshResult || Boolean(editing.dirty)}
              title={editing.dirty ? '请先保存或放弃修改' : '刷新当前结果'}
              onClick={model.refreshResult}
            >
              刷新
            </Button>
            {tab.kind !== 'query' && activeRunning && (
              <Button icon={<StopOutlined />} danger onClick={cancelQuery}>
                取消
              </Button>
            )}
            {showingResult && (
              <>
                <Input
                  style={{ width: 'var(--result-filter-width, 180px)' }}
                  prefix={<SearchOutlined />}
                  placeholder="筛选当前结果"
                  aria-label="筛选查询结果"
                  value={resultSearch}
                  onChange={(event) => {
                    setResultSearch(event.target.value)
                    setTablePage(1)
                  }}
                  allowClear
                  disabled={!result}
                />
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'all', label: '导出全部' },
                      { key: 'selected', label: `导出选中（${selectedRows.length}）`, disabled: !selectedRows.length }
                    ],
                    onClick: ({ key }) =>
                      result &&
                      exportCSV(
                        result.columns.map((column) => column.name),
                        key === 'selected' ? selectedResultRows(editing.rows, selectedRows, sort, sortType, result.rows) : exportResultRows(editing.rows, editing.newRows, orderedMatches)
                      )
                  }}
                  disabled={!result?.isQuery || deferredSearch !== resultSearch}
                >
                  <Button icon={<DownloadOutlined />} disabled={!result?.isQuery || deferredSearch !== resultSearch}>
                    导出 CSV <DownOutlined aria-hidden="true" className="dropdown-chevron" />
                  </Button>
                </Dropdown>
              </>
            )}
          </div>
        </div>
      )}
      {showingResult && !activeRunning && result?.truncated && <Alert type="warning" title="结果已达行数或大小上限，请收窄查询范围。" banner />}
      <div
        ref={viewport}
        className="result-scroll"
        tabIndex={0}
        aria-label="结果数据滚动区域"
        aria-busy={editing.saving}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: showingResult ? 'hidden' : 'auto', minWidth: 0 }}
      >
        {editing.saving && <ContentLoading label="正在保存并刷新数据…" className="result-saving-loading" />}
        {activeKey === 'messages' ? (
          <QueryMessages key={tab.id} run={run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeKey === 'summary' ? (
          <QuerySummary key={run.id} run={run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeRunning ? (
          <ContentLoading label="正在加载结果…" />
        ) : run?.error ? (
          <Alert style={{ margin: 16 }} type="error" showIcon title="执行失败" description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{run.error}</div>} />
        ) : result ? (
          <>
            <Table
              style={{ visibility: editing.saving ? 'hidden' : undefined }}
              ref={table}
              virtual
              size={appearance.tableSize}
              className="data-table"
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
                setTablePage(1)
              }}
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: scrollWidth, y: bodyHeight || 24 }}
              locale={{ emptyText: result.isQuery ? '查询成功，没有匹配的数据' : `语句执行成功，影响 ${result.affectedRows} 行` }}
            />
          </>
        ) : (
          <Empty className="query-empty" image={<TableOutlined className="empty-state-icon" />} description="暂无结果" style={{ margin: '20px 0' }} />
        )}
      </div>
      {showingResult && !activeRunning && result && hasTable && <Pagination {...tablePaginationDefaults} current={tablePage} onChange={setTablePage} total={rowCount} pageSize={50} />}
    </ResultsDock>
  )
}
