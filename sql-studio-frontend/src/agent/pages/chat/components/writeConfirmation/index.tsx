import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Button, Descriptions, Flex, Space, Tag, theme, Typography } from 'antd'

import ContentCard from '@/components/contentCard'
import { useTranslation } from '@/hooks/useTranslation'

import type { ConfirmationRequest } from '../../../../typings/writeConfirmation'
import { CHAT } from '../../constant/chat'
import { CodeBlock } from '../codeBlock'

interface Props {
  value: ConfirmationRequest
  submitting: boolean
  onDecide: (allow: boolean) => Promise<void>
}

export function WriteConfirmation({ value, submitting, onDecide }: Props) {
  const { t } = useTranslation()

  const { token } = theme.useToken()
  const writing = !('kind' in value)
  const title = writing ? t('等待确认 · 即将写入') : t('是否继续本轮')
  const continueLabel = writing ? t('确认执行') : value.kind === 'context' ? t('压缩后继续') : t('继续')
  const stopLabel = writing ? t('取消') : value.kind === 'input' ? t('返回编辑') : t('停止本轮')
  return (
    <ContentCard
      role="region"
      aria-label={writing ? t('数据库操作确认') : t('继续操作确认')}
      style={writing ? { background: token.colorWarningBg, borderColor: token.colorWarningBorder } : undefined}
      title={
        <Space>
          <ExclamationCircleOutlined style={writing ? { color: token.colorWarning } : undefined} />
          <span>{title}</span>
        </Space>
      }
      extra={writing ? <Tag color="warning">{t('完全访问模式')}</Tag> : undefined}
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
        <Flex gap={CHAT.spacing.detail} wrap justify="flex-end">
          {writing && (
            <Button disabled={submitting} onClick={() => void onDecide(false)}>
              {stopLabel}
            </Button>
          )}
          <Button type={writing ? 'primary' : 'default'} loading={submitting} disabled={submitting} onClick={() => void onDecide(true)}>
            {continueLabel}
          </Button>
          {!writing && (
            <Button disabled={submitting} onClick={() => void onDecide(false)}>
              {stopLabel}
            </Button>
          )}
        </Flex>
      </Flex>
    </ContentCard>
  )
}
