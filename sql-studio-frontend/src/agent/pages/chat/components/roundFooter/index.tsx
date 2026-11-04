import { Flex, Tooltip, Typography } from 'antd'

import type { Entry } from '../../../../typings/chat'
import { chatErrors } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'

interface Props {
  entries: Entry[]
  ongoing: boolean
  waiting: boolean
}
export function RoundFooter({ entries, ongoing, waiting }: Props) {
  const question = entries.find((entry) => entry.role === 'user')
  const answer = entries
    .filter((entry) => entry.role === 'assistant')
    .map((entry) => entry.text)
    .join('\n\n')
  const tools = entries.filter((entry) => entry.role === 'tool').length
  const failed = chatErrors(entries).length > 0 || entries.some((entry) => entry.incomplete)
  const stopped = entries.some((entry) => entry.stopped)
  return (
    <Flex align="center" gap={CHAT.spacing.detail} wrap>
      {answer && <Typography.Text copyable={{ text: answer, tooltips: ['复制回答', '已复制'] }} />}
      <Typography.Text type="secondary">
        {ongoing ? (waiting ? '等待确认' : '生成中') : stopped ? '已停止' : failed ? '未完成' : '已完成'}
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
