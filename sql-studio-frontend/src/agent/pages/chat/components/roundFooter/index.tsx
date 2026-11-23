import { ExportOutlined } from '@ant-design/icons'
import { Button, Collapse, Flex, Tooltip, Typography } from 'antd'

import { useNavigationLock } from '@/contexts/navigationLock'
import { useTranslation } from '@/hooks/useTranslation'
import { requestOpenQuery } from '@/services/openQuery'

import type { Entry } from '../../../../typings/chat'
import { answerTables } from '../../../../utils/answerTables'
import { chatErrors } from '../../../../utils/chatEvents'
import { CHAT } from '../../constant/chat'
import { ExportExcel } from '../exportExcel'

interface Props {
  entries: Entry[]
  ongoing: boolean
  waiting: boolean
}
export function RoundFooter({ entries, ongoing, waiting }: Props) {
  const { t, language } = useTranslation()
  const { locked } = useNavigationLock()

  const question = entries.find((entry) => entry.role === 'user')
  const answer = entries
    .filter((entry) => entry.role === 'assistant')
    .map((entry) => entry.text)
    .join('\n\n')
  const tools = entries.filter((entry) => entry.role === 'tool').length
  const errors = chatErrors(entries)
  const failed = errors.length > 0 || entries.some((entry) => entry.incomplete)
  const stopped = entries.some((entry) => entry.stopped)
  const parts = answer ? answerTables(answer) : []
  const sqlPart = parts.find((part) => part.kind === 'code' && /(sql|mysql|postgres)/i.test(part.language))
  const tablePart = [...parts].reverse().find((part) => part.kind === 'table')
  const sql = sqlPart?.kind === 'code' ? sqlPart.text : undefined
  const table = tablePart?.kind === 'table' ? tablePart.value : undefined
  return (
    <>
      {errors.length > 0 && (
        <Collapse
          size="small"
          items={[
            {
              key: 'error',
              label: t('查看失败原因'),
              children: (
                <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {errors.map((error) => t(error)).join('\n')}
                </Typography.Text>
              )
            }
          ]}
        />
      )}
      {(sql || table) && (
        <Flex align="center" gap={6} wrap>
          {sql && (
            <Typography.Text copyable={{ text: sql, tooltips: [t('复制 SQL'), t('已复制')] }} type="secondary">
              {t('复制 SQL')}
            </Typography.Text>
          )}
          {sql && (
            <Button type="text" size="small" icon={<ExportOutlined />} disabled={locked} onClick={() => requestOpenQuery(sql)}>
              {t('在查询页打开')}
            </Button>
          )}
          {table && <ExportExcel value={table} title={t('查询结果')} variant="link" />}
        </Flex>
      )}
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
    </>
  )
}
