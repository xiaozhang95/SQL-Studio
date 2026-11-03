import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Conversations } from '@ant-design/x'
import { Button, Drawer, Empty, Flex, Popconfirm, Spin, theme, Tooltip, Typography } from 'antd'

import type { ConversationInfo } from '../../../../typings/workspace'

interface Props {
  open: boolean
  items: ConversationInfo[]
  activeId: string
  busy: boolean
  loading: boolean
  onClose: () => void
  onSelect: (id: string) => Promise<void>
  onNew: () => void
  onRefresh: () => Promise<void>
  onDelete: (id: string) => Promise<void>
}
export function History(props: Props) {
  const { token } = theme.useToken()
  const { open, onClose } = props
  return (
    <>
      <aside
        className="chat-sidebar"
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <HistoryContents {...props} />
      </aside>
      <Drawer title="历史会话" placement="left" size={280} open={open} onClose={onClose} styles={{ body: { padding: 0 } }}>
        <HistoryContents {...props} />
      </Drawer>
    </>
  )
}
function HistoryContents({ items, activeId, busy, loading, onSelect, onNew, onRefresh, onClose, onDelete }: Props) {
  const { token } = theme.useToken()
  return (
    <Flex
      vertical
      style={{
        height: '100%',
        minHeight: 0,
        padding: token.paddingXS,
        gap: token.marginSM,
        paddingTop: token.paddingSM
      }}
    >
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={busy}
        onClick={() => {
          onNew()
          onClose()
        }}
        block
      >
        新建会话
      </Button>
      <Flex align="center" justify="space-between" style={{ paddingInline: token.paddingXS, paddingTop: token.paddingXS }}>
        <Typography.Text type="secondary">历史会话</Typography.Text>
        <Tooltip title="刷新历史">
          <Button type="text" size="small" aria-label="刷新历史" icon={<ReloadOutlined />} onClick={() => void onRefresh()} disabled={loading} />
        </Tooltip>
      </Flex>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Spin spinning={loading}>
          {items.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有对话" />
          ) : (
            <Conversations
              activeKey={activeId}
              onActiveChange={(key) => {
                if (!busy) void onSelect(key)
              }}
              styles={{ root: { padding: 0 }, item: { paddingInline: 8 } }}
              items={items.map((i) => ({
                key: i.id,
                disabled: busy,
                label: (
                  <Flex align="center" justify="space-between" gap="small">
                    <Typography.Text ellipsis title={i.title} style={{ minWidth: 0, flex: 1 }}>
                      {i.title}
                    </Typography.Text>
                    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <Popconfirm title="删除这条会话？" description="将删除本机保存的消息和查询结果。" okText="删除" cancelText="取消" onConfirm={() => onDelete(i.id)} disabled={busy}>
                        <Button danger type="text" size="small" aria-label={'删除会话 ' + i.title} disabled={busy} icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </span>
                  </Flex>
                )
              }))}
            />
          )}
        </Spin>
      </div>
      <Typography.Text type="secondary" style={{ padding: token.paddingSM }}>
        对话保存在本机
      </Typography.Text>
    </Flex>
  )
}
