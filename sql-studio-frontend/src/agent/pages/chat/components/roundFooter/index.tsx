import { Flex, Tooltip, Typography } from 'antd'

import type { Entry } from '../../../../typings/chat'
import { chatErrors } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'

interface Props {
  entries: Entry[]
  ongoing: boolean
}
export function RoundFooter({ entries, ongoing }: Props) {
  const question = entries.find((entry) => entry.role === 'user')
  const answer = entries
    .filter((entry) => entry.role === 'assistant')
    .map((entry) => entry.text)
    .join('\n\n')
  const tools = entries.filter((entry) => entry.role === 'tool').length
  const failed = chatErrors(entries).length > 0 || entries.some((entry) => entry.incomplete)
  return (
    <Flex align="center" gap={CHAT.spacing.detail} wrap>
      {answer && <Typography.Text copyable={{ text: answer, tooltips: ['复制回答', '已复制'] }} />}
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
