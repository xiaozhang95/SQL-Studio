import { DeleteOutlined, EditOutlined, ImportOutlined, SearchOutlined, StarOutlined } from '@ant-design/icons'
import { Button, Drawer, Form, Input, Modal, Space, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useMemo, useState } from 'react'

import DeleteConfirmation from '@/components/deleteConfirmation'
import ErrorNotice from '@/components/errorNotice'
import { appearance, ComponentSize } from '@/constant/appearance'
import { usePageError } from '@/contexts/pageErrors'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { Connection } from '@/typings/database'
import type { ThemeMode } from '@/typings/theme'
import type { QueryFavorite } from '@/typings/workspace'

import type { useQueryFavorites } from '../../hooks/useQueryFavorites'
import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import SQLPreview from '../sqlPreview'
import ToolbarButton from '../toolbarButton'

type Favorites = ReturnType<typeof useQueryFavorites>

type Props = {
  favorites: Favorites
  connections: Connection[]
  themeMode: ThemeMode
  canOpen: boolean
  onOpen: (item: QueryFavorite) => void
}

function FavoriteNameDialog({ favorites, title }: { favorites: Favorites; title?: string }) {
  const { t } = useTranslation()
  const [form] = Form.useForm<{ title: string }>()
  const saving = favorites.busy === 'write'
  return (
    <Modal
      open
      title={t(title ? '重命名收藏' : '收藏查询')}
      onOk={() => form.submit()}
      onCancel={favorites.closeEditor}
      confirmLoading={saving}
      closable={!saving}
      keyboard={!saving}
      mask={{ closable: !saving }}
      cancelButtonProps={{ disabled: saving }}
      okButtonProps={{ disabled: Boolean(favorites.busy) }}
      okText={t('保存')}
      cancelText={t('取消')}
    >
      <Form
        form={form}
        initialValues={{ title }}
        layout="horizontal"
        labelCol={{ flex: '88px' }}
        wrapperCol={{ flex: '1 1 0' }}
        labelAlign="right"
        disabled={saving}
        onFinish={({ title: value }) => void favorites.save(value)}
      >
        <Form.Item name="title" label={t('名称')} rules={[{ required: true, whitespace: true, message: t('请输入名称') }]}>
          <Input autoFocus maxLength={80} placeholder={t('请输入名称')} />
        </Form.Item>
      </Form>
      <ErrorNotice error={favorites.editError} />
    </Modal>
  )
}

export default function QueryFavorites({ favorites, connections, themeMode, canOpen, onOpen }: Props) {
  const { t } = useTranslation()
  const pagination = useTablePagination()
  const { items, open, draft, busy, error, reload, setOpen, edit, remove } = favorites
  usePageError(open ? error : undefined)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [drawerReady, setDrawerReady] = useState(false)
  const needle = search.trim().toLowerCase()
  const shown = useMemo(() => (needle ? items.filter((item) => [item.title, item.sql, item.database, item.schema].some((value) => value?.toLowerCase().includes(needle))) : items), [items, needle])
  const pageSize = 10
  const current = Math.min(page, Math.max(1, Math.ceil(shown.length / pageSize)))
  const { viewport, bodyHeight } = useTableViewportLayout(`${open}:${drawerReady}:${shown.length}`)
  const renderSQL = (item: QueryFavorite) => <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={connections.find(({ id }) => id === item.connectionId)?.type} />
  const columns: TableColumnsType<QueryFavorite> = [
    {
      title: t('名称'),
      key: 'title',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
      render: (title: string) => <Typography.Text strong>{title}</Typography.Text>
    },
    {
      title: t('连接'),
      key: 'connection',
      width: 168,
      ellipsis: true,
      render: (_, item) => {
        const connection = connections.find((candidate) => candidate.id === item.connectionId)
        return connection ? [connection.name, item.database, item.schema].filter(Boolean).join(' / ') : t(item.connectionId ? '原连接已删除' : '未选择连接')
      }
    },
    {
      title: 'SQL',
      key: 'sql',
      dataIndex: 'sql',
      width: 280,
      render: (_, item) => renderSQL(item)
    },
    {
      title: t('操作'),
      key: 'actions',
      width: 112,
      render: (_, item) => (
        <Space size={2}>
          <ToolbarButton label={t('打开收藏查询')} icon={<ImportOutlined />} size={ComponentSize.Small} disabled={!canOpen} onClick={() => onOpen(item)} />
          <ToolbarButton label={t('重命名收藏')} icon={<EditOutlined />} size={ComponentSize.Small} disabled={Boolean(busy)} onClick={() => edit(item)} />
          <DeleteConfirmation
            title={t('删除此查询收藏？')}
            disabled={Boolean(busy)}
            onConfirm={async () => {
              await remove(item.id)
            }}
          >
            <ToolbarButton label={t('删除收藏')} icon={<DeleteOutlined />} size={ComponentSize.Small} danger disabled={Boolean(busy)} />
          </DeleteConfirmation>
        </Space>
      )
    }
  ]
  return (
    <>
      <Drawer
        title={
          <Space>
            <StarOutlined />
            {t('查询收藏')}
          </Space>
        }
        open={open}
        onClose={() => setOpen(false)}
        afterOpenChange={setDrawerReady}
        size="min(860px, 100vw)"
        styles={{ body: { display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        extra={
          error ? (
            <Button size="small" loading={busy === 'read'} onClick={() => void reload()}>
              {t('重试')}
            </Button>
          ) : undefined
        }
      >
        <Input
          style={{ flexShrink: 0 }}
          value={search}
          prefix={<SearchOutlined />}
          aria-label={t('搜索查询收藏')}
          placeholder={t('搜索名称 / SQL / 数据库')}
          allowClear
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
        />
        <div ref={viewport} style={{ flex: 1, minHeight: 0, minWidth: 0, marginTop: 16, overflow: 'hidden' }}>
          <Table<QueryFavorite>
            size={appearance.tableSize}
            rowKey="id"
            columns={columns}
            dataSource={shown}
            loading={busy === 'read'}
            scroll={{ x: 800, y: bodyHeight || 24 }}
            expandable={{ columnWidth: 48, expandedRowRender: renderSQL }}
            pagination={{ ...pagination, current, pageSize, onChange: setPage }}
            locale={{ emptyText: t(needle ? '没有匹配的查询收藏' : '暂无查询收藏') }}
          />
        </div>
      </Drawer>
      {draft && <FavoriteNameDialog key={draft.id ?? 'new'} favorites={favorites} title={draft.title} />}
    </>
  )
}
