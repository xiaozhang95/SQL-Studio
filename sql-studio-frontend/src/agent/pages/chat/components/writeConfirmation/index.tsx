import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Descriptions, Flex, Space, Typography } from 'antd'

import type { WriteConfirmationRequest } from '../../../../typings/writeConfirmation'
import { CHAT } from '../../constant/chat'
import { CodeBlock } from '../codeBlock'

interface Props {
  value: WriteConfirmationRequest
  submitting: boolean
  error: string
  onDecide: (allow: boolean) => Promise<void>
}

export function WriteConfirmation({ value, submitting, error, onDecide }: Props) {
  return (
    <Card
      size="small"
      role="region"
      aria-label="数据库操作确认"
      title={
        <Space>
          <ExclamationCircleOutlined />
          <span>待确认的数据库操作</span>
        </Space>
      }
      style={{ width: '100%', minWidth: 0 }}
    >
      <Flex vertical gap={CHAT.spacing.block}>
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
        {error && <Alert type="error" showIcon title={error} />}
        <Flex gap={CHAT.spacing.detail} wrap>
          <Button type="primary" loading={submitting} disabled={submitting} onClick={() => void onDecide(true)}>
            确认执行
          </Button>
          <Button disabled={submitting} onClick={() => void onDecide(false)}>
            取消执行
          </Button>
        </Flex>
      </Flex>
    </Card>
  )
}
