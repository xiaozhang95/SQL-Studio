import { Typography } from 'antd'

import DeleteDialog from '@/components/deleteDialog'
import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey } from '@/services/redis'

type Props = {
  item?: RedisKey
  saving: boolean
  disabled?: boolean
  error: string
  onConfirm: () => void
  onCancel: () => void
}

export default function KeyDelete({ item, saving, disabled, error, onConfirm, onCancel }: Props) {
  const { t } = useTranslation()
  return (
    <DeleteDialog title={t('删除键')} open={Boolean(item)} busy={saving} disabled={disabled} onConfirm={onConfirm} onCancel={onCancel}>
      <Typography.Paragraph>{t('确定删除 Redis 键「{value1}」？', { value1: item?.name ?? '' })}</Typography.Paragraph>
      <ErrorNotice error={error} />
    </DeleteDialog>
  )
}
