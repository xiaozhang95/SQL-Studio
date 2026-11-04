import { Flex, Typography } from 'antd'

import { answerTables } from '../../../../utils/answerTables'
import { CHAT } from '../../constant/chat'
import { CodeBlock } from '../codeBlock'
import { QueryResult } from '../queryResult'

export function AnswerContent({ text }: { text: string }) {
  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0 }}>
      {answerTables(text).map((part, index) => {
        if (part.kind === 'table') return <QueryResult key={index} value={part.value} showHeader={false} />
        if (part.kind === 'code') return <CodeBlock key={index} text={part.text} language={part.language} />
        const content = part.text.trim()
        return content ? (
          <Typography.Paragraph key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>
            {content}
          </Typography.Paragraph>
        ) : null
      })}
    </Flex>
  )
}
