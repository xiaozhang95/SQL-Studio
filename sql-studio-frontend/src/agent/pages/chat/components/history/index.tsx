import { DeleteOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Conversations } from '@ant-design/x'
import { Alert, Button, Drawer, Empty, Flex, Form, Input, Modal, Popconfirm, Spin, theme, Tooltip, Typography } from 'antd'
import { useState } from 'react'
import type { ReactNode } from 'react'

import type { useSidebarResize } from '@/hooks/useSidebarResize'

import type { ConversationInfo } from '../../../../typings/workspace'
import { CHAT } from '../../constant/chat'
import { useSessionRename } from '../../hooks/sessionRename'

interface Props {
  layout: ReturnType<typeof useSidebarResize>
  footer?: ReactNode
  open: boolean
  items: ConversationInfo[]
  activeId: string
  busy: boolean
  selecting: boolean
  loading: boolean
  onClose: () => void
  onSelect: (id: string) => Promise<void>
  onRefresh: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
}
export function History(props: Props) {
  const { panel: panelRef, visibleWidth, minimumWidth, maximumWidth, resizer } = props.layout
  const { token } = theme.useToken()
  const { open, onClose } = props
  const rename = useSessionRename(props.onRename)
  const [search, setSearch] = useState('')
  const keyword = search.trim().toLowerCase()
  const items = keyword ? props.items.filter(({ title }) => title.toLowerCase().includes(keyword)) : props.items
  const contentsProps = { ...props, items, search, onSearchChange: setSearch, onRenameOpen: rename.show }
  const refreshAction = (
    <Tooltip title="刷新历史">
      <Button type="text" size="small" aria-label="刷新历史" icon={<ReloadOutlined />} onClick={() => void props.onRefresh()} disabled={props.loading} />
    </Tooltip>
  )
  return (
    <>
      <aside
        ref={panelRef}
        className="chat-sidebar"
        style={{
          position: 'relative',
          width: visibleWidth,
          background: token.colorBgContainer,
          borderRight: '1px solid var(--border)'
        }}
      >
        <HistoryContents
          {...contentsProps}
          header={
            <Flex align="center" justify="space-between" style={{ paddingInline: token.paddingXS }}>
              <Typography.Text type="secondary">历史会话</Typography.Text>
              {refreshAction}
            </Flex>
          }
        />
        <div
          className="sidebar-resizer"
          role="separator"
          aria-label="调整历史会话栏宽度"
          aria-orientation="vertical"
          aria-valuemin={minimumWidth}
          aria-valuemax={maximumWidth}
          aria-valuenow={Math.round(visibleWidth)}
          tabIndex={0}
          {...resizer}
          style={{ position: 'absolute', insetBlock: 0, insetInlineEnd: 0, width: 5, zIndex: 3, cursor: 'col-resize', touchAction: 'none' }}
        />
      </aside>
      <Drawer title="历史会话" extra={refreshAction} placement="left" size={280} open={open} onClose={onClose} styles={{ body: { padding: 0 } }}>
        <HistoryContents {...contentsProps} />
      </Drawer>
      <Modal
        title="重命名会话"
        open={Boolean(rename.selected)}
        onCancel={rename.close}
        onOk={() => rename.form.submit()}
        confirmLoading={rename.busy}
        okText="保存"
        cancelText="取消"
        closable={!rename.busy}
        mask={{ closable: !rename.busy }}
        keyboard={!rename.busy}
        cancelButtonProps={{ disabled: rename.busy }}
      >
        {rename.error && <Alert type="error" title={rename.error} style={{ marginBottom: 16 }} />}
        <Form form={rename.form} layout="horizontal" labelCol={{ flex: '80px' }} wrapperCol={{ flex: '1 1 0', style: { minWidth: 0 } }} disabled={rename.busy} onFinish={rename.save}>
          <Form.Item
            name="title"
            label="会话名称"
            rules={[
              { required: true, whitespace: true, message: '请输入会话名称' },
              { max: CHAT.maxTitleLength, message: `最多${CHAT.maxTitleLength}个字符` },
              { pattern: /^\P{Cc}+$/u, message: '名称不能包含换行或控制字符' }
            ]}
          >
            <Input
              aria-label="会话名称"
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
  onDelete,
  onRenameOpen,
  search,
  onSearchChange,
  footer,
  header
}: Props & { onRenameOpen: (item: ConversationInfo) => void; search: string; onSearchChange: (value: string) => void; header?: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <Flex
      vertical
      style={{
        height: '100%',
        minHeight: 0,
        padding: token.paddingXS,
        paddingInline: 'var(--workspace-inset)',
        gap: token.marginSM,
        paddingTop: token.paddingSM
      }}
    >
      <Input prefix={<SearchOutlined />} value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索会话标题" aria-label="搜索会话标题" allowClear />
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={search.trim() ? '没有匹配的会话' : '还没有对话'} />
          ) : (
            <Conversations
              activeKey={activeId}
              onActiveChange={(key) => {
                if (!busy) void onSelect(key)
              }}
              styles={{ root: { padding: 0 }, item: { paddingInline: token.paddingXS } }}
              items={items.map((i) => ({
                key: i.id,
                disabled: busy,
                label: (
                  <Flex className="chat-history-row" align="center" justify="space-between" gap="small">
                    <Typography.Text ellipsis title={i.title} style={{ minWidth: 0, flex: 1 }}>
                      {i.title}
                    </Typography.Text>
                    <span className="chat-history-actions" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Button type="text" size="small" aria-label={'重命名会话 ' + i.title} disabled={busy || selecting} icon={<EditOutlined />} onClick={() => onRenameOpen(i)} />
                      <Popconfirm title="删除这条会话？" description="将删除本机保存的消息和查询结果。" okText="删除" cancelText="取消" onConfirm={() => onDelete(i.id)} disabled={busy || selecting}>
                        <Button danger type="text" size="small" aria-label={'删除会话 ' + i.title} disabled={busy || selecting} icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </span>
                  </Flex>
                )
              }))}
            />
          )}
        </Spin>
      </div>
      {footer && <div style={{ flexShrink: 0, marginInline: 'calc(-1 * var(--workspace-inset))', marginBottom: -token.paddingXS }}>{footer}</div>}
    </Flex>
  )
}
