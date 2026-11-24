import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, HistoryOutlined, ImportOutlined, SearchOutlined, StopOutlined } from '@ant-design/icons'
import { Drawer, Empty, Input, Space, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import type { CSSProperties } from 'react'

import DeleteDialog from '@/components/deleteDialog'
import EmptyStateIcon from '@/components/emptyStateIcon'
import EngineIcon from '@/components/engineIcon'
import ErrorNotice from '@/components/errorNotice'
import { ResizableTable } from '@/components/resizableTable'
import { appearance, ComponentSize } from '@/constant/appearance'
import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { HistoryItem } from '@/typings/workspace'

import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { executionCancelled } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'
import ToolbarButton from '../toolbarButton'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    'history' | 'clearHistory' | 'historyOpen' | 'setHistoryOpen' | 'historySearch' | 'setHistorySearch' | 'running' | 'savedConnections' | 'connectionId' | 'loadHistory' | 'objects'
  >
  terminal?: boolean
  onLoad?: (item: HistoryItem) => void
  onClosed?: () => void
}
/** 表格提供执行概览，展开查看完整 SQL；载入追加到当前 SQL 页。 */
export default function QueryHistory({ model, themeMode, terminal = false, onLoad, onClosed }: Props) {
  const tablePagination = useTablePagination()

  const { t, language } = useTranslation()

  const { history, clearHistory, historyOpen, setHistoryOpen, historySearch, setHistorySearch, running, savedConnections: connections, connectionId, loadHistory } = model
  const connection = connections.find((item) => item.id === connectionId)
  const redis = connection?.type === DatabaseEngine.Redis
  // 历史属于创建的连接；同一连接下切库仍可查看全部记录，不用库名或显示名称匹配。
  const connectionHistory = history
  const [page, setPage] = useState(1)
  const [drawerReady, setDrawerReady] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const { viewport, bodyHeight } = useTableViewportLayout(`${historyOpen}:${drawerReady}:${connectionId}:${connectionHistory.length}:${historySearch}`)
  const columns: TableColumnsType<HistoryItem> = [
    {
      title: t('状态'),
      dataIndex: 'ok',
      width: 100,
      filters: [
        { text: t('成功'), value: 'success' },
        { text: t('失败'), value: 'error' },
        { text: t('执行已取消'), value: 'cancelled' }
      ],
      onFilter: (value, item) => value === (executionCancelled(item) ? 'cancelled' : item.ok ? 'success' : 'error'),
      render: (ok: boolean, item) =>
        executionCancelled(item) ? (
          <Tag icon={<StopOutlined />}>{t('执行已取消')}</Tag>
        ) : (
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
    ...(!redis && connection && getDatabaseAdapter(connection.type).explorer
      ? [{ title: 'Schema', dataIndex: 'schema', width: 140, ellipsis: true, render: (schema: string) => schema || t('默认搜索路径') }]
      : []),
    {
      title: redis ? t('Redis 命令') : 'SQL',
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
          <Space size={2}>
            <ToolbarButton
              label={t(terminal ? '载入命令行' : '载入编辑器')}
              hint={missing ? t('原连接已删除') : undefined}
              icon={<ImportOutlined />}
              size={ComponentSize.Small}
              disabled={running || missing}
              onClick={() => (onLoad ?? loadHistory)(item)}
            />
          </Space>
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
      onClose={() => {
        setConfirmClear(false)
        setHistoryOpen(false)
      }}
      focusable={terminal ? { focusTriggerAfterClose: false } : undefined}
      afterOpenChange={(open) => {
        setDrawerReady(open)
        if (!open) {
          setConfirmClear(false)
          onClosed?.()
        }
      }}
      size="min(1080px, 100vw)"
      styles={{ body: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      extra={<ToolbarButton label={t('清空执行历史')} icon={<DeleteOutlined />} danger aria-haspopup="dialog" disabled={!connectionHistory.length} onClick={() => setConfirmClear(true)} />}
    >
      <Input
        style={{ flexShrink: 0 }}
        prefix={<SearchOutlined />}
        placeholder={t(redis ? '搜索命令 / 数据库' : '搜索 SQL / 数据库')}
        aria-label={t('搜索执行历史')}
        value={historySearch}
        onChange={(event) => {
          setHistorySearch(event.target.value)
          setPage(1)
        }}
        allowClear
      />
      <div ref={viewport} style={{ flex: 1, minHeight: 0, minWidth: 0, marginTop: 16, overflow: 'hidden' }}>
        <ResizableTable<HistoryItem>
          size={appearance.tableSize}
          className="history-table"
          resizeKey={connectionId ?? ''}
          style={{ '--history-body-height': `${bodyHeight || 24}px` } as CSSProperties}
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
                {!executionCancelled(item) && <ErrorNotice title={t('执行失败')} error={item.error} />}
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
      <DeleteDialog
        title={t('清空连接「{value1}」的执行历史？', { value1: connection?.name || '' })}
        open={historyOpen && confirmClear}
        confirmText={t('清空')}
        disabled={!connectionHistory.length}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          if (!historyOpen || !confirmClear || !connectionHistory.length) return
          clearHistory(connectionId)
          setPage(1)
          setConfirmClear(false)
        }}
      >
        {t('将清空该连接的全部 {value1} 条执行历史，包括筛选未显示的记录。', { value1: connectionHistory.length })}
      </DeleteDialog>
    </Drawer>
  )
}
