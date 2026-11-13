import { Alert, Collapse, Flex, Typography } from 'antd'
import { useMemo } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

import { answerTables } from '../../../../utils/answerTables'
import { CHAT } from '../../constant/chat'
import { AnswerMarkdown } from '../answerMarkdown'
import { CodeBlock } from '../codeBlock'
import { QueryResult } from '../queryResult'

export function AnswerContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const { t } = useTranslation()

  const parts = useMemo(() => answerTables(text), [text])
  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0 }}>
      {parts.map((part, index) => {
        if (part.kind === 'table') return <QueryResult key={index} value={part.value} showHeader={false} />
        if (part.kind === 'code') return <CodeBlock key={index} text={part.text} language={part.language} />
        if (part.kind === 'pending-table')
          return streaming ? (
            <Typography.Text key={index} type="secondary">
              {t('正在整理查询结果…')}
            </Typography.Text>
          ) : (
            <Flex key={index} vertical gap={CHAT.spacing.detail}>
              <Alert type="warning" showIcon title={t('表格内容未完整生成，请在执行过程中查看已返回的查询结果。')} />
              <Collapse size="small" items={[{ key: 'original', label: t('查看未完成的原始内容'), children: <CodeBlock text={part.text} language="json" /> }]} />
            </Flex>
          )
        const content = part.text.trim()
        return content ? <AnswerMarkdown key={index} text={content} /> : null
      })}
    </Flex>
  )
}
