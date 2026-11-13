import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Button, Descriptions, Flex, Space, Typography } from 'antd'

import ContentCard from '@/components/contentCard'
import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'

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
  const { t } = useTranslation()

  const writing = !('kind' in value)
  const title = writing ? t('待确认的数据库操作') : t('是否继续本轮')
  const continueLabel = writing ? t('确认执行') : value.kind === 'context' ? t('压缩后继续') : t('继续')
  const stopLabel = writing ? t('取消执行') : value.kind === 'input' ? t('返回编辑') : t('停止本轮')
  return (
    <ContentCard
      role="region"
      aria-label={writing ? t('数据库操作确认') : t('继续操作确认')}
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
            <Typography.Text>{t('确认后将实际修改数据库，操作可能不可撤销。请核对目标和 SQL。')}</Typography.Text>
            <Descriptions
              column={1}
              size="small"
              styles={{ content: { overflowWrap: 'anywhere' } }}
              items={[
                { key: 'connection', label: t('连接'), children: value.connection },
                { key: 'database', label: t('数据库'), children: value.database },
                { key: 'objects', label: t('涉及表／对象'), children: value.objects.length ? value.objects.join('、') : t('请核对下方 SQL 中的对象') }
              ]}
            />
            <CodeBlock language="sql" text={value.sql} />
          </>
        ) : (
          <Typography.Text>{value.detail}</Typography.Text>
        )}
        <ErrorNotice error={error} />
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
