import { Typography } from 'antd'
import { Fragment } from 'react'

import { answerTables } from '../../../../utils/answerTables'
import { CodeBlock } from '../codeBlock'
import { QueryResult } from '../queryResult'

export function AnswerContent({ text }: { text: string }) {
  return (
    <Fragment>
      {answerTables(text).map((part, index) =>
        part.kind === 'table' ? (
          <QueryResult key={index} title="回答结果" value={part.value} />
        ) : part.kind === 'code' ? (
          <CodeBlock key={index} text={part.text} language={part.language} />
        ) : (
          <Typography.Paragraph key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>
            {part.text}
          </Typography.Paragraph>
        )
      )}
    </Fragment>
  )
}
