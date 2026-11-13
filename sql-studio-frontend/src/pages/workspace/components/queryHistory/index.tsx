import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, HistoryOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons'
import { App as AntApp, Drawer, Empty, Input, Table, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import type { CSSProperties } from 'react'

import EmptyStateIcon from '@/components/emptyStateIcon'
import ErrorNotice from '@/components/errorNotice'
import { appearance, ComponentSize } from '@/constant/appearance'
import { getDatabaseAdapter } from '@/databases'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { HistoryItem } from '@/typings/workspace'

import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import EngineIcon from '../engineIcon'
import SQLPreview from '../sqlPreview'
import ToolbarButton from '../toolbarButton'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    'history' | 'clearHistory' | 'historyOpen' | 'setHistoryOpen' | 'historySearch' | 'setHistorySearch' | 'running' | 'connections' | 'connectionId' | 'connection' | 'loadHistory' | 'objects'
  >
}
/** 表格提供执行概览，展开查看完整 SQL；载入追加到当前 SQL 页。 */
export default function QueryHistory({ model, themeMode }: Props) {
  const tablePagination = useTablePagination()

  const { t, language } = useTranslation()

  const { history, clearHistory, historyOpen, setHistoryOpen, historySearch, setHistorySearch, running, connections, connectionId, connection, loadHistory } = model
  // 历史属于创建的连接；同一连接下切库仍可查看全部记录，不用库名或显示名称匹配。
  const connectionHistory = history
  const { modal } = AntApp.useApp()
  const [page, setPage] = useState(1)
  const [drawerReady, setDrawerReady] = useState(false)
  const { viewport, bodyHeight } = useTableViewportLayout(`${historyOpen}:${drawerReady}:${connectionId}:${connectionHistory.length}:${historySearch}`)
  const columns: TableColumnsType<HistoryItem> = [
    {
      title: t('状态'),
      dataIndex: 'ok',
      width: 100,
      filters: [
        { text: t('成功'), value: true },
        { text: t('失败'), value: false }
      ],
      onFilter: (value, item) => item.ok === value,
      render: (ok: boolean) => (
        <Tag color={ok ? 'success' : 'error'} icon={ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {ok ? t('成功') : t('失败')}
        </Tag>
      )
    },
    {
      title: t('执行时间'),
      dataIndex: 'time',
      width: 180,
      sorter: (a, b) => Date.parse(a.time) - Date.parse(b.time),
      render: (time: string) => new Date(time).toLocaleString(language, { hour12: false })
    },
    { title: t('连接'), dataIndex: 'connectionName', width: 140, ellipsis: true },
    { title: t('数据库'), dataIndex: 'database', width: 140, ellipsis: true, render: (database: string) => database || t('未选择数据库') },
    ...(connections.some((connection) => connection.id === model.connectionId && getDatabaseAdapter(connection.type).explorer)
      ? [{ title: 'Schema', dataIndex: 'schema', width: 140, ellipsis: true, render: (schema: string) => schema || t('默认搜索路径') }]
      : []),
    {
      title: 'SQL',
      dataIndex: 'sql',
      width: 280,
      render: (sql: string, item) => <SQLPreview compact sql={sql} themeMode={themeMode} databaseType={connections.find((value) => value.id === item.connectionId)?.type} />
    },
    { title: t('耗时'), dataIndex: 'durationMs', width: 110, sorter: (a, b) => a.durationMs - b.durationMs, render: (duration: number) => `${duration} ms` },
    {
      title: t('操作'),
      key: 'actions',
      width: 64,
      fixed: 'right',
      render: (_, item) => {
        const missing = !connections.some((connection) => connection.id === item.connectionId)
        return (
          <ToolbarButton
            label={t('载入编辑器')}
            hint={missing ? t('原连接已删除') : undefined}
            icon={<ImportOutlined />}
            size={ComponentSize.Small}
            disabled={running || missing}
            onClick={() => loadHistory(item)}
          />
        )
      }
    }
  ]
  return (
    <Drawer
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
          <HistoryOutlined />
          <span style={{ flexShrink: 0 }}>{t('执行历史')}</span>
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
      afterOpenChange={setDrawerReady}
      size="min(1080px, 100vw)"
      styles={{ body: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      extra={
        <ToolbarButton
          label={t('清空执行历史')}
          icon={<DeleteOutlined />}
          danger
          disabled={!connectionHistory.length}
          onClick={() =>
            modal.confirm({
              title: t('清空连接「{value1}」的执行历史？', { value1: connection?.name || '' }),
              onOk: () => {
                clearHistory(connectionId)
                setPage(1)
              }
            })
          }
        />
      }
    >
      <Input
        style={{ flexShrink: 0 }}
        prefix={<SearchOutlined />}
        placeholder={t('搜索 SQL / 数据库')}
        aria-label={t('搜索执行历史')}
        value={historySearch}
        onChange={(event) => {
          setHistorySearch(event.target.value)
          setPage(1)
        }}
        allowClear
      />
      <div
        ref={viewport}
        className="history-table-viewport"
        style={{ flex: 1, minHeight: 0, minWidth: 0, marginTop: 16, overflow: 'hidden', ...({ '--history-body-height': `${bodyHeight}px` } as CSSProperties) }}
      >
        <Table<HistoryItem>
          size={appearance.tableSize}
          className="history-table"
          rowKey="id"
          columns={columns}
          dataSource={connectionHistory.filter((item) => `${item.sql} ${item.database} ${item.schema || ''}`.toLowerCase().includes(historySearch.toLowerCase()))}
          scroll={{ x: 1200, y: bodyHeight || 24 }}
          pagination={{ ...tablePagination, current: page, pageSize: 10 }}
          onChange={(pagination) => setPage(pagination.current || 1)}
          expandable={{
            columnTitle: <span style={{ whiteSpace: 'nowrap' }}>{t('详情')}</span>,
            columnWidth: 72,
            expandedRowRender: (item) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={connections.find((value) => value.id === item.connectionId)?.type} />
                <ErrorNotice title={t('执行失败')} error={item.error} />
              </div>
            )
          }}
          locale={{
            emptyText: (
              <Empty
                image={
                  <EmptyStateIcon>
                    <HistoryOutlined />
                  </EmptyStateIcon>
                }
                description={connectionHistory.length ? t('没有匹配的执行记录') : t('当前连接暂无执行历史')}
              />
            )
          }}
        />
      </div>
    </Drawer>
  )
}
