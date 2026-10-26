import { CloseOutlined, DownloadOutlined, EyeOutlined, LoadingOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined, StopOutlined, TableOutlined, UndoOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Table } from 'antd'
import { useEffect, useState } from 'react'

import { appearance } from '@/constant/appearance'
import type { ThemeMode } from '@/typings/theme'
import { exportCSV } from '@/utils/csv'

import { tablePaginationDefaults } from '../../constant/tablePagination'
import { useDataEditing } from '../../hooks/useDataEditing'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { statementOutputs } from '../../utils/queryOutput'
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
  const [view, setView] = useState<'messages' | 'summary' | null>(null)
  const hasResults = run ? statementOutputs(run).length > 0 : false
  const showingResult = view === null && hasResults
  const activeKey = view ?? (hasResults ? String(resultIndex) : 'messages')
  const databaseType = model.connections.find((connection) => connection.id === tab.connectionId)?.type
  const { viewport, bodyHeight } = useTableViewportLayout(`${run?.id}:${view}`)
  useEffect(() => {
    const body = viewport.current?.querySelector<HTMLElement>('.ant-table-body')
    if (body) body.scrollTop = 0
  }, [run?.id, tablePage, resultSearch, view, viewport])
  const rows = (result?.rows || [])
    .map((cells, index) => ({ key: index, cells: cells.map((value, column) => editing.display(index, column, value)) }))
    .filter(
      ({ cells }) =>
        !resultSearch ||
        cells.some((cell) =>
          String(cell ?? 'NULL')
            .toLowerCase()
            .includes(resultSearch.toLowerCase())
        )
    )
  rows.unshift(...editing.newRows.map((row) => ({ key: row.key, cells: row.cells })))
  const columns = [
    {
      title: '#',
      key: 'index',
      width: 64,
      fixed: 'left' as const,
      render: (_: unknown, row: { key: number }) =>
        row.key < 0 ? <Button type="text" size="small" icon={<CloseOutlined />} aria-label="移除新增行" disabled={editingBlocked} onClick={() => editing.removeNewRow(row.key)} /> : row.key + 1
    },
    ...(result?.columns || []).map((column, index) => ({
      title: (
        <div className="column-title">
          {column.name}
          {column.type && <span className="column-type">{column.type.toLowerCase()}</span>}
        </div>
      ),
      key: String(index),
      onCell: (row: { key: number }) => ({
        style: editing.isDirty(row.key, index) ? { background: 'var(--ant-color-warning-bg)' } : undefined,
        onDoubleClick: () => {
          if (tab.kind === 'data' && row.key >= 0) void editing.begin(row.key, index)
        }
      }),
      width: run?.kind === 'ddl' ? undefined : 200,
      render: (_: unknown, row: { key: number; cells: unknown[] }) =>
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
        ) : run?.kind === 'ddl' && typeof row.cells[index] === 'string' ? (
          <SQLPreview compact sql={row.cells[index] === undefined ? '(默认)' : String(row.cells[index])} themeMode={themeMode} databaseType={databaseType} maxHeight="none" />
        ) : row.cells[index] === null ? (
          <span className="cell-null">(NULL)</span>
        ) : (
          <span className={run?.kind === 'structure' && column.name === '表名' ? 'database-object-name' : undefined}>
            {run?.kind === 'structure' &&
              column.name === '表名' &&
              (String(row.cells[result?.columns.findIndex((item) => item.name === '类型') ?? -1]).includes('VIEW') ? <EyeOutlined /> : <TableOutlined />)}
            <span className="cell-value" title={row.cells[index] === undefined ? '使用默认值' : String(row.cells[index])}>
              {row.cells[index] === undefined ? '(默认)' : String(row.cells[index])}
            </span>
          </span>
        )
    }))
  ]
  if (!run) return null
  return (
    <ResultsDock resizable={tab.kind === 'query'} height={model.resultHeight} onHeightChange={model.setResultHeight}>
      {run.interrupted && <Alert type="warning" banner title="上次执行因页面刷新中断，已完成结果保留；未自动继续执行。" />}
      <ResultTabs
        run={run}
        running={activeRunning}
        activeKey={activeKey}
        onChange={(key) => {
          if (key === 'messages' || key === 'summary') setView(key)
          else {
            selectResult(Number(key))
            setView(null)
          }
        }}
      />
      {(showingResult || (activeRunning && tab.kind !== 'query')) && (
        <div className="result-toolbar">
          <div className="result-meta">
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
                <Button icon={<SaveOutlined />} type="primary" loading={editing.saving} disabled={editingBlocked || !editing.dirty} onClick={() => void editing.save()}>
                  保存
                </Button>
                <Button icon={<UndoOutlined />} disabled={editingBlocked || !editing.dirty} onClick={editing.cancel}>
                  放弃修改
                </Button>
              </>
            )}
          </div>
          <div className="result-actions">
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
                <Button
                  icon={<DownloadOutlined />}
                  disabled={!result?.isQuery}
                  onClick={() =>
                    result &&
                    exportCSV(
                      result.columns.map((column) => column.name),
                      rows.map((row) => row.cells)
                    )
                  }
                >
                  导出 CSV
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      <div ref={viewport} className="result-scroll" tabIndex={0} aria-label="结果数据滚动区域" style={{ overflow: showingResult ? 'hidden' : 'auto', minWidth: 0 }}>
        {activeKey === 'messages' ? (
          <QueryMessages run={run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeKey === 'summary' ? (
          <QuerySummary run={run} running={activeRunning} themeMode={themeMode} databaseType={databaseType} />
        ) : activeRunning ? (
          <div className="tree-loading">
            <LoadingOutlined spin /> 正在加载结果
          </div>
        ) : run?.error ? (
          <Alert style={{ margin: 16 }} type="error" showIcon title="执行失败" description={<pre style={{ whiteSpace: 'pre-wrap' }}>{run.error}</pre>} />
        ) : result ? (
          <>
            {result.truncated && <Alert type="warning" title="结果已达行数或大小上限，请收窄查询范围。" banner />}
            <Table
              size={appearance.tableSize}
              className="data-table"
              tableLayout={run.kind === 'ddl' ? 'fixed' : undefined}
              columns={columns}
              dataSource={rows.slice((tablePage - 1) * 50, tablePage * 50)}
              pagination={false}
              scroll={{ x: run.kind === 'ddl' ? '100%' : 'max-content', y: bodyHeight || undefined }}
              locale={{ emptyText: result.isQuery ? '查询成功，没有匹配的数据' : `语句执行成功，影响 ${result.affectedRows} 行` }}
            />
          </>
        ) : (
          <Empty className="query-empty" image={<TableOutlined className="empty-state-icon" />} description="暂无结果" />
        )}
      </div>
      {showingResult && !activeRunning && result && <Pagination {...tablePaginationDefaults} current={tablePage} onChange={setTablePage} total={rows.length} pageSize={50} />}
    </ResultsDock>
  )
}
