import { CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, App as AntApp, Button, Drawer, Empty, Input, Table, Tag, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import type { CSSProperties } from 'react'

import { appearance, ComponentSize } from '@/constant/appearance'
import type { ThemeMode } from '@/typings/theme'
import type { HistoryItem } from '@/typings/workspace'

import { tablePaginationDefaults } from '../../constant/tablePagination'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import EngineIcon from '../engineIcon'
import SQLPreview from '../sqlPreview'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    'history' | 'clearHistory' | 'historyOpen' | 'setHistoryOpen' | 'historySearch' | 'setHistorySearch' | 'running' | 'connections' | 'connectionId' | 'connection' | 'loadHistory' | 'objects'
  >
}

/** 表格提供执行概览，展开查看完整 SQL；载入追加到当前 SQL 页。 */
export default function QueryHistory({ model, themeMode }: Props) {
  const { history, clearHistory, historyOpen, setHistoryOpen, historySearch, setHistorySearch, running, connections, connectionId, connection, loadHistory } = model
  // 历史属于创建的连接；同一连接下切库仍可查看全部记录，不用库名或显示名称匹配。
  const connectionHistory = history
  const { modal } = AntApp.useApp()
  const [page, setPage] = useState(1)
  const { viewport, bodyHeight } = useTableViewportLayout(`${historyOpen}:${connectionId}:${connectionHistory.length}:${historySearch}`)
  const columns: TableColumnsType<HistoryItem> = [
    {
      title: '状态',
      dataIndex: 'ok',
      width: 100,
      filters: [
        { text: '成功', value: true },
        { text: '失败', value: false }
      ],
      onFilter: (value, item) => item.ok === value,
      render: (ok: boolean) => (
        <Tag color={ok ? 'success' : 'error'} icon={ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {ok ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: '执行时间',
      dataIndex: 'time',
      width: 180,
      sorter: (a, b) => Date.parse(a.time) - Date.parse(b.time),
      render: (time: string) => new Date(time).toLocaleString('zh-CN', { hour12: false })
    },
    { title: '连接', dataIndex: 'connectionName', width: 140, ellipsis: true },
    { title: '数据库', dataIndex: 'database', width: 140, ellipsis: true, render: (database: string) => database || '未选择数据库' },
    {
      title: 'SQL',
      dataIndex: 'sql',
      width: 280,
      render: (sql: string, item) => <SQLPreview compact singleLine sql={sql} themeMode={themeMode} databaseType={connections.find((value) => value.id === item.connectionId)?.type} maxHeight="32px" />
    },
    { title: '耗时', dataIndex: 'durationMs', width: 110, sorter: (a, b) => a.durationMs - b.durationMs, render: (duration: number) => `${duration} ms` },
    {
      title: '操作',
      key: 'actions',
      width: 124,
      fixed: 'right',
      render: (_, item) => {
        const missing = !connections.some((connection) => connection.id === item.connectionId)
        return (
          <Tooltip title={missing ? '原连接已删除' : undefined}>
            <Button type="link" size={ComponentSize.Small} disabled={running || missing} onClick={() => loadHistory(item)}>
              载入编辑器
            </Button>
          </Tooltip>
        )
      }
    }
  ]
  return (
    <Drawer
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          <HistoryOutlined />
          <span style={{ flexShrink: 0 }}>执行历史</span>
          {connection && (
            <>
              <span>·</span>
              <EngineIcon type={connection.type} connected={model.objects.snapshots[connection.id]?.status === 'connected'} />
              <span title={connection.name} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {connection.name}
              </span>
            </>
          )}
        </span>
      }
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      size={1080}
      forceRender
      styles={{ body: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      extra={
        <Button
          type="text"
          danger
          disabled={!connectionHistory.length}
          onClick={() =>
            modal.confirm({
              title: `清空连接「${connection?.name || ''}」的执行历史？`,
              onOk: () => {
                clearHistory(connectionId)
                setPage(1)
              }
            })
          }
        >
          清空
        </Button>
      }
    >
      <Input
        style={{ flexShrink: 0 }}
        prefix={<SearchOutlined />}
        placeholder="搜索 SQL / 数据库"
        aria-label="搜索执行历史"
        value={historySearch}
        onChange={(event) => {
          setHistorySearch(event.target.value)
          setPage(1)
        }}
        allowClear
      />
      <div ref={viewport} className="history-table-viewport" style={{ '--history-body-height': `${bodyHeight}px` } as CSSProperties}>
        <Table<HistoryItem>
          size={appearance.tableSize}
          className="history-table"
          rowKey="id"
          columns={columns}
          dataSource={connectionHistory.filter((item) => `${item.sql} ${item.database}`.toLowerCase().includes(historySearch.toLowerCase()))}
          scroll={{ x: 1200, y: bodyHeight || undefined }}
          pagination={{ ...tablePaginationDefaults, current: page, pageSize: 10 }}
          onChange={(pagination) => setPage(pagination.current || 1)}
          expandable={{
            columnTitle: <span style={{ whiteSpace: 'nowrap' }}>详情</span>,
            columnWidth: 72,
            expandedRowRender: (item) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={connections.find((value) => value.id === item.connectionId)?.type} maxHeight="240px" />
                {item.error && <Alert type="error" showIcon title="执行失败" description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.error}</div>} />}
              </div>
            )
          }}
          locale={{ emptyText: <Empty image={<HistoryOutlined className="empty-state-icon" />} description={connectionHistory.length ? '没有匹配的执行记录' : '当前连接暂无执行历史'} /> }}
        />
      </div>
    </Drawer>
  )
}
