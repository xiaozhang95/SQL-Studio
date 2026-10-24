import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ProfileOutlined,
  SearchOutlined,
  TableOutlined
} from '@ant-design/icons'
import { Alert, Button, Empty, Input, Pagination, Table, Tabs } from 'antd'
import { useEffect } from 'react'

import { exportCSV } from '@/utils/csv'

import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ResultsDock from '../resultsDock'

type Props = {
  model: Pick<WorkspaceModel, 'result' | 'run' | 'running' | 'resultTabs' | 'selectResult' | 'closeResult' | 'resultSearch' | 'setResultSearch' | 'tablePage' | 'setTablePage'>
}

/** 底部仅展示结果快照；表操作从对象树菜单发起，分页独立于滚动内容。 */
export default function QueryResults({ model }: Props) {
  const { result, run, running, resultTabs, selectResult, closeResult, resultSearch, setResultSearch, tablePage, setTablePage } = model
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
          <span className="cell-value" title={String(row.cells[index])}>
            {String(row.cells[index])}
          </span>
        )
    }))
  ]
  if (!resultTabs.length) return null
  return (
    <ResultsDock
      header={
        <Tabs
          className="workspace-tabs result-query-tabs"
          size="small"
          tabBarGutter={4}
          type="editable-card"
          hideAdd
          activeKey={run?.id}
          onChange={selectResult}
          onEdit={(key, action) => {
            if (action === 'remove') closeResult(String(key))
          }}
          items={resultTabs.map((item, index) => ({
            key: item.id!,
            icon: item.kind === 'data' ? <TableOutlined /> : item.kind === 'structure' ? <ProfileOutlined /> : item.kind === 'ddl' ? <FileTextOutlined /> : <CodeOutlined />,
            label: `${item.title || '结果'} ${index + 1}`,
            closable: true
          }))}
        />
      }
    >
      <div className="result-toolbar">
        <div className="result-meta">
          {running ? (
            <span className="result-status">
              <LoadingOutlined spin /> 执行中
            </span>
          ) : run?.error ? (
            <span className="result-status is-error">
              <CloseCircleOutlined /> 失败
            </span>
          ) : result ? (
            <>
              <span className="result-status is-success">
                <CheckCircleOutlined /> 成功
              </span>
              <span className="result-status">
                <ClockCircleOutlined /> {result.durationMs} ms
              </span>
            </>
          ) : (
            <span>待执行</span>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', flex: 'none', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Pagination current={tablePage} onChange={setTablePage} total={rows.length} pageSize={50} showSizeChanger={false} showTotal={(total) => `共 ${total} 行`} />
        </div>
      )}
    </ResultsDock>
  )
}
