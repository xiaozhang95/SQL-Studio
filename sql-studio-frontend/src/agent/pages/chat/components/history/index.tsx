import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { Conversations } from '@ant-design/x'
import { Alert, Button, Drawer, Empty, Flex, Form, Input, Modal, Popconfirm, Spin, theme, Tooltip, Typography } from 'antd'

import type { ConversationInfo } from '../../../../typings/workspace'
import { CHAT } from '../../constant/chat'
import { useSessionRename } from '../../hooks/sessionRename'

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
  onRename: (id: string, title: string) => Promise<void>
}
export function History(props: Props) {
  const { token } = theme.useToken()
  const { open, onClose } = props
  const rename = useSessionRename(props.onRename)
  return (
    <>
      <aside
        className="chat-sidebar"
        style={{
          background: token.colorBgLayout,
          borderRight: `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <HistoryContents {...props} onRenameOpen={rename.show} />
      </aside>
      <Drawer title="历史会话" placement="left" size={280} open={open} onClose={onClose} styles={{ body: { padding: 0 } }}>
        <HistoryContents {...props} onRenameOpen={rename.show} />
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
function HistoryContents({ items, activeId, busy, loading, onSelect, onNew, onRefresh, onClose, onDelete, onRenameOpen }: Props & { onRenameOpen: (item: ConversationInfo) => void }) {
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
                      <Button type="text" size="small" aria-label={'重命名会话 ' + i.title} disabled={busy} icon={<EditOutlined />} onClick={() => onRenameOpen(i)} />
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
    </Flex>
  )
}
