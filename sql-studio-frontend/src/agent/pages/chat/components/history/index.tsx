import { DeleteOutlined, EditOutlined, MessageOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Conversations } from '@ant-design/x'
import { Button, Drawer, Empty, Flex, Form, Input, Modal, Spin, theme, Tooltip, Typography } from 'antd'
import { useRef, useState } from 'react'

import DeleteDialog from '@/components/deleteDialog'
import ErrorNotice from '@/components/errorNotice'
import { SidebarHeader, SidebarSearch } from '@/components/sidebarControls'
import type { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslation } from '@/hooks/useTranslation'

import type { ConversationInfo } from '../../../../typings/workspace'
import { CHAT } from '../../constant/chat'
import { useSessionRename } from '../../hooks/sessionRename'

interface Props {
  mobile: boolean
  layout: ReturnType<typeof useSidebarResize>
  open: boolean
  items: ConversationInfo[]
  activeId: string
  busy: boolean
  selecting: boolean
  loading: boolean
  onClose: () => void
  onSelect: (id: string) => Promise<void>
  onNew: () => void
  onRefresh: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
}
export function History(props: Props) {
  const { t } = useTranslation()

  const { panel: panelRef, visibleWidth, minimumWidth, maximumWidth, resizer } = props.layout
  const { token } = theme.useToken()
  const { open, onClose, mobile } = props
  const rename = useSessionRename(props.onRename)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ConversationInfo>()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const deletePending = useRef(false)
  const deletionDisabled = props.busy || props.selecting
  const canDeleteTarget = !deletionDisabled && props.items.some((item) => item.id === deleteTarget?.id)

  function requestDelete(item: ConversationInfo) {
    if (deletionDisabled || deletePending.current) return
    setDeleteError('')
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget || !canDeleteTarget || deletePending.current) return
    deletePending.current = true
    setDeleting(true)
    setDeleteError('')
    try {
      await props.onDelete(deleteTarget.id)
      setDeleteTarget(undefined)
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : t('删除会话失败'))
    } finally {
      deletePending.current = false
      setDeleting(false)
    }
  }

  const keyword = search.trim().toLowerCase()
  const items = keyword ? props.items.filter(({ title }) => title.toLowerCase().includes(keyword)) : props.items
  const contentsProps = { ...props, items, search, onSearchChange: setSearch, onRenameOpen: rename.show, onDeleteOpen: requestDelete }
  const refreshAction = (
    <Tooltip title={t('刷新历史')}>
      <Button type="text" size="small" aria-label={t('刷新历史')} icon={<ReloadOutlined />} onClick={() => void props.onRefresh()} disabled={props.loading} />
    </Tooltip>
  )
  const newAction = (
    <Tooltip title={t('新建会话')}>
      <Button type="text" size="small" aria-label={t('新建会话')} icon={<PlusOutlined />} onClick={props.onNew} disabled={props.busy || props.selecting || props.loading} />
    </Tooltip>
  )
  return (
    <>
      <aside
        ref={panelRef}
        style={{
          position: 'relative',
          display: mobile ? 'none' : 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          height: '100%',
          width: visibleWidth,
          background: token.colorBgContainer,
          borderRight: '1px solid var(--layout-divider)'
        }}
      >
        <SidebarHeader
          title={t('会话')}
          count={props.items.length}
          actions={
            <>
              {refreshAction}
              {newAction}
            </>
          }
        />
        <HistoryContents {...contentsProps} />
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label={t('调整历史会话栏宽度')}
          aria-orientation="vertical"
          aria-valuemin={minimumWidth}
          aria-valuemax={maximumWidth}
          aria-valuenow={Math.round(visibleWidth)}
          tabIndex={0}
          {...resizer}
          style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 5, zIndex: 3, cursor: 'col-resize', touchAction: 'none' }}
        />
      </aside>
      <Drawer
        title={t('历史会话')}
        extra={
          <Flex align="center" gap={2}>
            {newAction}
            {refreshAction}
          </Flex>
        }
        placement="left"
        size={280}
        open={mobile && open}
        onClose={onClose}
        styles={{ body: { padding: 0 } }}
      >
        <HistoryContents {...contentsProps} />
      </Drawer>
      <DeleteDialog
        title={t('删除这条会话？')}
        open={Boolean(deleteTarget)}
        busy={deleting}
        disabled={!canDeleteTarget}
        onCancel={() => {
          if (!deletePending.current) setDeleteTarget(undefined)
        }}
        onConfirm={() => void confirmDelete()}
      >
        <Typography.Paragraph strong>{deleteTarget?.title}</Typography.Paragraph>
        <Typography.Paragraph>{t('将删除本机保存的消息和查询结果。')}</Typography.Paragraph>
        <ErrorNotice error={deleteError} />
      </DeleteDialog>
      <Modal
        forceRender
        title={t('重命名会话')}
        open={Boolean(rename.selected)}
        onCancel={rename.close}
        onOk={() => rename.form.submit()}
        confirmLoading={rename.busy}
        okText={t('保存')}
        cancelText={t('取消')}
        closable={!rename.busy}
        mask={{ closable: !rename.busy }}
        keyboard={!rename.busy}
        cancelButtonProps={{ disabled: rename.busy }}
      >
        <ErrorNotice error={rename.error} style={{ marginBottom: token.margin }} />
        <Form form={rename.form} layout="horizontal" labelCol={{ flex: '80px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={rename.busy} onFinish={rename.save}>
          <Form.Item
            name="title"
            label={t('会话名称')}
            rules={[
              { required: true, whitespace: true, message: t('请输入会话名称') },
              { max: CHAT.maxTitleLength, message: t('最多{value1}个字符', { value1: CHAT.maxTitleLength }) },
              { pattern: /^\P{Cc}+$/u, message: t('名称不能包含换行或控制字符') }
            ]}
          >
            <Input
              aria-label={t('会话名称')}
              maxLength={CHAT.maxTitleLength}
              onPressEnter={(event) => {
                event.preventDefault()
                rename.form.submit()
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
function HistoryContents({
  items,
  activeId,
  busy,
  selecting,
  loading,
  onSelect,
  onDeleteOpen,
  onRenameOpen,
  search,
  onSearchChange
}: Props & { onRenameOpen: (item: ConversationInfo) => void; onDeleteOpen: (item: ConversationInfo) => void; search: string; onSearchChange: (value: string) => void }) {
  const { t, language } = useTranslation()

  const { token } = theme.useToken()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000
  const timeLabel = (updatedAt: string) => {
    const time = Date.parse(updatedAt)
    if (!Number.isFinite(time)) return ''
    if (time >= startOfToday.getTime()) return new Date(time).toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', hour12: false })
    if (time >= startOfYesterday) return t('昨天')
    const date = new Date(time)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
  // 设计稿按最近更新时间分组，组内维持服务端返回顺序之外的时间倒序。
  const grouped = [
    { key: 'today', label: '今天', items: [] as ConversationInfo[] },
    { key: 'yesterday', label: '昨天', items: [] as ConversationInfo[] },
    { key: 'earlier', label: '更早', items: [] as ConversationInfo[] }
  ]
  ;[...items]
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .forEach((item) => {
      const time = Date.parse(item.updatedAt)
      grouped[time >= startOfToday.getTime() ? 0 : time >= startOfYesterday ? 1 : 2].items.push(item)
    })
  return (
    <Flex vertical style={{ flex: 1, height: '100%', minHeight: 0 }}>
      <SidebarSearch value={search} onChange={onSearchChange} placeholder={t('搜索会话标题')} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingInline: token.padding, paddingBlock: token.paddingXS }}>
        <Spin spinning={loading} styles={{ container: { display: 'flex', flexDirection: 'column', rowGap: token.marginXS } }}>
          {items.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? t('没有匹配的会话') : t('还没有对话')} />
          ) : (
            grouped.map((group) =>
              group.items.length ? (
                <div key={group.key}>
                  {group.key !== 'earlier' && (
                    <Typography.Text strong type="secondary" style={{ display: 'block', minHeight: 28, padding: '6px 8px 0' }}>
                      {t(group.label)}
                    </Typography.Text>
                  )}
                  <Conversations
                    className="chat-history-list"
                    activeKey={activeId}
                    onActiveChange={(key) => {
                      if (!busy) void onSelect(key)
                    }}
                    styles={{
                      root: { display: 'flex', flexDirection: 'column', rowGap: token.marginXXS, padding: 0 },
                      item: { minHeight: 34, padding: '5px 8px' }
                    }}
                    items={group.items.map((i) => ({
                      key: i.id,
                      disabled: busy,
                      label: (
                        <Flex className="chat-history-row" align="center" justify="space-between" gap="small">
                          <MessageOutlined className="chat-history-icon" style={{ flexShrink: 0 }} />
                          <Typography.Text ellipsis title={i.title} style={{ minWidth: 0, flex: 1 }}>
                            {i.title}
                          </Typography.Text>
                          <span className="chat-history-time" style={{ flex: 'none', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                            {timeLabel(i.updatedAt)}
                          </span>
                          <span className="chat-history-actions" style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <Button type="text" size="small" aria-label={t('重命名会话 ') + i.title} disabled={busy || selecting} icon={<EditOutlined />} onClick={() => onRenameOpen(i)} />
                            <Button
                              danger
                              type="text"
                              size="small"
                              aria-label={t('删除会话 ') + i.title}
                              aria-haspopup="dialog"
                              disabled={busy || selecting}
                              icon={<DeleteOutlined />}
                              onClick={() => onDeleteOpen(i)}
                            />
                          </span>
                        </Flex>
                      )
                    }))}
                  />
                </div>
              ) : null
            )
          )}
        </Spin>
      </div>
    </Flex>
  )
}
