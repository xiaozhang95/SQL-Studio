import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, CloseOutlined, DatabaseOutlined, DownloadOutlined, LoadingOutlined, SearchOutlined, TableOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Table, Tabs, Tag, Tooltip } from 'antd'
import { useEffect } from 'react'

import { exportCSV } from '@/utils/csv'

import { useResultTableLayout } from '../../hooks/useResultTableLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ResultsDock from '../resultsDock'

type Props = {
  model: Pick<
    WorkspaceModel,
    'result' | 'run' | 'running' | 'resultTabs' | 'selectResult' | 'closeResult' | 'resultSearch' | 'setResultSearch' | 'tablePage' | 'setTablePage' | 'resultsCollapsed' | 'setResultsCollapsed'
  >
}

/** 底部仅展示结果快照；表操作从对象树菜单发起，分页独立于滚动内容。 */
export default function QueryResults({ model }: Props) {
  const { result, run, running, resultTabs, selectResult, closeResult, resultSearch, setResultSearch, tablePage, setTablePage, resultsCollapsed, setResultsCollapsed } = model
  const { viewport, bodyHeight } = useResultTableLayout(run?.id)
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
    { title: '#', key: 'index', width: 64, render: (_: unknown, row: { key: number }) => row.key + 1 },
    ...(result?.columns || []).map((column, index) => ({
      title: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          {column.name}
          {column.type && <Tag color="blue">{column.type}</Tag>}
        </div>
      ),
      key: String(index),
      width: 200,
      render: (_: unknown, row: { cells: unknown[] }) =>
        row.cells[index] === null ? (
          <Tag color="blue">NULL</Tag>
        ) : (
          <span className="cell-value" title={String(row.cells[index])}>
            {String(row.cells[index])}
          </span>
        )
    }))
  ]
  if (!resultTabs.length) return null
  return (
    <ResultsDock
      collapsed={resultsCollapsed}
      onCollapsedChange={setResultsCollapsed}
      header={
        resultTabs.length ? (
          <Tabs
            className="result-query-tabs"
            tabBarGutter={24}
            tabBarStyle={{ margin: 0 }}
            style={{ minWidth: 0, flex: 1 }}
            type="line"
            activeKey={run?.id}
            onChange={selectResult}
            items={resultTabs.map((item, index) => ({
              key: item.id!,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {`${item.title || '结果'} ${index + 1}`}
                  <Button
                    type="text"
                    size="small"
                    aria-label={`关闭结果 ${index + 1}`}
                    icon={<CloseOutlined />}
                    onFocus={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      closeResult(item.id!)
                    }}
                  />
                </span>
              )
            }))}
          />
        ) : (
          <span>查询结果</span>
        )
      }
    >
      <div className="result-toolbar">
        <div className="result-meta">
          {running ? (
            <Tag color="processing" icon={<LoadingOutlined spin />}>
              执行中
            </Tag>
          ) : run?.error ? (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              失败
            </Tag>
          ) : result ? (
            <>
              <Tag color="success" icon={<CheckCircleOutlined />}>
                成功
              </Tag>
              <Tag color="blue" icon={<ClockCircleOutlined />}>
                {result.durationMs} ms
              </Tag>
            </>
          ) : (
            <Tag color="blue">待执行</Tag>
          )}
          {run?.source && (
            <Tooltip title={`结果来源：${run.source}`}>
              <Tag color="blue" className="result-scope-tag" icon={<DatabaseOutlined />}>
                {run.source}
              </Tag>
            </Tooltip>
          )}
        </div>
        <div className="result-actions">
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
        {run?.error ? (
          <Alert style={{ margin: 16 }} type="error" showIcon title="SQL 执行失败" description={<pre style={{ whiteSpace: 'pre-wrap' }}>{run.error}</pre>} />
        ) : result ? (
          <>
            {result.truncated && <Alert type="warning" title="结果已达行数或大小上限，请收窄查询范围。" banner />}
            <Table
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
      {result && (
        <div style={{ flex: 'none', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Pagination current={tablePage} onChange={setTablePage} total={rows.length} pageSize={50} showSizeChanger={false} showTotal={(total) => `共 ${total} 行`} />
        </div>
      )}
    </ResultsDock>
  )
}
