import { ClockCircleOutlined, DownloadOutlined, EyeOutlined, LoadingOutlined, SearchOutlined, StopOutlined, TableOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Table } from 'antd'
import { useEffect } from 'react'

import { appearance } from '@/constant/appearance'
import { exportCSV } from '@/utils/csv'

import { tablePaginationDefaults } from '../../constant/tablePagination'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ResultsDock from '../resultsDock'
import ResultSelect from '../resultSelect'

type Props = {
  model: Pick<
    WorkspaceModel,
    'result' | 'run' | 'activeRunning' | 'tab' | 'cancelQuery' | 'resultSearch' | 'setResultSearch' | 'tablePage' | 'setTablePage' | 'resultIndex' | 'selectResult' | 'resultHeight' | 'setResultHeight'
  >
}

/** 展示当前页面的最新结果；表操作从对象树菜单发起，分页独立于滚动内容。 */
export default function QueryResults({ model }: Props) {
  const { result, run, activeRunning, tab, cancelQuery, resultSearch, setResultSearch, tablePage, setTablePage, resultIndex, selectResult } = model
  const { viewport, bodyHeight } = useTableViewportLayout(run?.id)
  useEffect(() => {
    const body = viewport.current?.querySelector<HTMLElement>('.ant-table-body')
    if (body) body.scrollTop = 0
  }, [run?.id, tablePage, resultSearch, viewport])
  const rows = (result?.rows || [])
    .map((cells, index) => ({ key: index, cells }))
    .filter(
      ({ cells }) =>
        !resultSearch ||
        cells.some((cell) =>
          String(cell ?? 'NULL')
            .toLowerCase()
            .includes(resultSearch.toLowerCase())
        )
    )
  const columns = [
    { title: '#', key: 'index', width: 64, fixed: 'left' as const, render: (_: unknown, row: { key: number }) => row.key + 1 },
    ...(result?.columns || []).map((column, index) => ({
      title: (
        <div className="column-title">
          {column.name}
          {column.type && <span className="column-type">{column.type.toLowerCase()}</span>}
        </div>
      ),
      key: String(index),
      width: 200,
      render: (_: unknown, row: { cells: unknown[] }) =>
        row.cells[index] === null ? (
          <span className="cell-null">(NULL)</span>
        ) : (
          <span className={run?.kind === 'structure' && column.name === '表名' ? 'database-object-name' : undefined}>
            {run?.kind === 'structure' &&
              column.name === '表名' &&
              (String(row.cells[result?.columns.findIndex((item) => item.name === '类型') ?? -1]).includes('VIEW') ? <EyeOutlined /> : <TableOutlined />)}
            <span className="cell-value" title={String(row.cells[index])}>
              {String(row.cells[index])}
            </span>
          </span>
        )
    }))
  ]
  if (!run) return null
  return (
    <ResultsDock resizable={tab.kind === 'query'} height={model.resultHeight} onHeightChange={model.setResultHeight}>
      {run.interrupted && <Alert type="warning" banner title="上次执行因页面刷新中断，已完成结果保留；未自动继续执行。" />}
      <div className="result-toolbar">
        <div className="result-meta">
          <ResultSelect run={run} running={activeRunning} resultIndex={resultIndex} onChange={selectResult} />
          {!activeRunning && !run.error && result && (
            <span className="result-status">
              <ClockCircleOutlined /> {result.durationMs} ms
            </span>
          )}
        </div>
        <div className="result-actions">
          {tab.kind !== 'query' && activeRunning && (
            <Button icon={<StopOutlined />} danger onClick={cancelQuery}>
              取消
            </Button>
          )}
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
        </div>
      </div>
      <div ref={viewport} className="result-scroll" tabIndex={0} aria-label="结果数据滚动区域" style={{ overflow: 'hidden', minWidth: 0 }}>
        {activeRunning ? (
          <div className="tree-loading">
            <LoadingOutlined spin /> 正在加载结果
          </div>
        ) : run?.error ? (
          <Alert style={{ margin: 16 }} type="error" showIcon title="SQL 执行失败" description={<pre style={{ whiteSpace: 'pre-wrap' }}>{run.error}</pre>} />
        ) : result ? (
          <>
            {result.truncated && <Alert type="warning" title="结果已达行数或大小上限，请收窄查询范围。" banner />}
            <Table
              size={appearance.tableSize}
              className="data-table"
              columns={columns}
              dataSource={rows.slice((tablePage - 1) * 50, tablePage * 50)}
              pagination={false}
              scroll={{ x: 'max-content', y: bodyHeight || undefined }}
              locale={{ emptyText: result.isQuery ? '查询成功，没有匹配的数据' : `语句执行成功，影响 ${result.affectedRows} 行` }}
            />
          </>
        ) : (
          <Empty className="query-empty" image={<TableOutlined className="empty-state-icon" />} description="暂无结果" />
        )}
      </div>
      {result && <Pagination {...tablePaginationDefaults} current={tablePage} onChange={setTablePage} total={rows.length} pageSize={50} />}
    </ResultsDock>
  )
}
