import { Flex, Tooltip, Typography } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

import type { Entry } from '../../../../typings/chat'
import { chatErrors } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'

interface Props {
  entries: Entry[]
  ongoing: boolean
  waiting: boolean
}
export function RoundFooter({ entries, ongoing, waiting }: Props) {
  const { t, language } = useTranslation()

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
      {answer && <Typography.Text copyable={{ text: answer, tooltips: [t('复制回答'), t('已复制')] }} />}
      <Typography.Text type="secondary">
        {ongoing ? (waiting ? t('等待确认') : t('生成中')) : stopped ? t('已停止') : failed ? t('未完成') : t('已完成')}
        {tools > 0 ? t(' · {value1} 项操作', { value1: tools }) : ''}
      </Typography.Text>
      {question?.createdAt && (
        <Tooltip title={t('提问时间')}>
          <Typography.Text type="secondary">{new Date(question.createdAt).toLocaleTimeString(language, { hour12: false })}</Typography.Text>
        </Tooltip>
      )}
    </Flex>
  )
}
