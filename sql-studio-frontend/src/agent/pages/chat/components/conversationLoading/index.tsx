import { Flex, Spin, Typography } from 'antd'

export function ConversationLoading({ label = '正在加载历史消息' }: { label?: string }) {
  return (
    <Flex role="status" aria-live="polite" align="center" justify="center" gap="small" style={{ width: '100%', paddingBlock: 12, whiteSpace: 'nowrap' }}>
      <Spin size="small" />
      <Typography.Text type="secondary">{label}</Typography.Text>
    </Flex>
  )
}
