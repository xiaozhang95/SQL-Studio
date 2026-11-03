import { EditOutlined } from '@ant-design/icons'
import { Button, Flex, theme, Tooltip, Typography } from 'antd'

import type { Entry } from '../../../../typings/chat'
import { chatErrors } from '../../../../utils/chatEvents'

interface Props {
  entries: Entry[]
  ongoing: boolean
  busy: boolean
  onEdit: (text: string) => void
}
export function RoundFooter({ entries, ongoing, busy, onEdit }: Props) {
  const { token } = theme.useToken()
  const question = entries.find((entry) => entry.role === 'user')
  const answer = entries
    .filter((entry) => entry.role === 'assistant')
    .map((entry) => entry.text)
    .join('\n\n')
  const tools = entries.filter((entry) => entry.role === 'tool').length
  const failed = chatErrors(entries).length > 0 || entries.some((entry) => entry.incomplete)
  return (
    <Flex align="center" gap="small" wrap style={{ paddingBlock: token.paddingXS }}>
      {answer && <Typography.Text copyable={{ text: answer, tooltips: ['复制回答', '已复制'] }} />}
      {question && (
        <Tooltip title="重新编辑问题">
          <Button type="text" size="small" aria-label="重新编辑问题" icon={<EditOutlined />} disabled={busy} onClick={() => onEdit(question.text)} />
        </Tooltip>
      )}
      <Typography.Text type="secondary">
        {ongoing ? '生成中' : failed ? '未完成' : '已完成'}
        {tools > 0 ? ` · ${tools} 项操作` : ''}
      </Typography.Text>
      {question?.createdAt && (
        <Tooltip title="提问时间">
          <Typography.Text type="secondary">{new Date(question.createdAt).toLocaleTimeString('zh-CN', { hour12: false })}</Typography.Text>
        </Tooltip>
      )}
    </Flex>
  )
}
