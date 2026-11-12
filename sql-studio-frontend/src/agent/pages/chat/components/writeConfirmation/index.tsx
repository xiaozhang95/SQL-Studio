import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Flex, Space, Typography } from 'antd'

import ContentCard from '@/components/contentCard'

import type { ConfirmationRequest } from '../../../../typings/writeConfirmation'
import { CHAT } from '../../constant/chat'
import { CodeBlock } from '../codeBlock'

interface Props {
  value: ConfirmationRequest
  submitting: boolean
  error: string
  onDecide: (allow: boolean) => Promise<void>
}

export function WriteConfirmation({ value, submitting, error, onDecide }: Props) {
  const writing = !('kind' in value)
  const title = writing ? '待确认的数据库操作' : '是否继续本轮'
  const continueLabel = writing ? '确认执行' : value.kind === 'context' ? '压缩后继续' : '继续'
  const stopLabel = writing ? '取消执行' : value.kind === 'input' ? '返回编辑' : '停止本轮'
  return (
    <ContentCard
      role="region"
      aria-label={writing ? '数据库操作确认' : '继续操作确认'}
      title={
        <Space>
          <ExclamationCircleOutlined />
          <span>{title}</span>
        </Space>
      }
    >
      <Flex vertical gap={CHAT.spacing.block}>
        {writing ? (
          <>
            <Typography.Text>确认后将实际修改数据库，操作可能不可撤销。请核对目标和 SQL。</Typography.Text>
            <Descriptions
              column={1}
              size="small"
              styles={{ content: { overflowWrap: 'anywhere' } }}
              items={[
                { key: 'connection', label: '连接', children: value.connection },
                { key: 'database', label: '数据库', children: value.database },
                { key: 'objects', label: '涉及表／对象', children: value.objects.length ? value.objects.join('、') : '请核对下方 SQL 中的对象' }
              ]}
            />
            <CodeBlock language="sql" text={value.sql} />
          </>
        ) : (
          <Typography.Text>{value.detail}</Typography.Text>
        )}
        {error && <Alert type="error" showIcon title={error} />}
        <Flex gap={CHAT.spacing.detail} wrap>
          <Button type="default" loading={submitting} disabled={submitting} onClick={() => void onDecide(true)}>
            {continueLabel}
          </Button>
          <Button disabled={submitting} onClick={() => void onDecide(false)}>
            {stopLabel}
          </Button>
        </Flex>
      </Flex>
    </ContentCard>
  )
}
