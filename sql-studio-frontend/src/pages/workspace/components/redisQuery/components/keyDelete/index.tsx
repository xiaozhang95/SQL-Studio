import { useState } from 'react'
import type { ReactElement } from 'react'

import DeleteConfirmation from '@/components/deleteConfirmation'
import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { RedisKey } from '@/services/redis'

type Props = {
  item: RedisKey
  saving: boolean
  disabled?: boolean
  error: string
  onDelete: (item: RedisKey) => Promise<boolean>
  onClearError: () => void
  children: ReactElement
}

/** 详情按钮使用全局删除气泡，目标绑定当前键。 */
export default function KeyDelete({ item, saving, disabled = false, error, onDelete, onClearError, children }: Props) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  function changeOpen(next: boolean) {
    if (saving) return
    if (next) onClearError()
    setVisible(next)
  }
  return (
    <DeleteConfirmation
      open={visible}
      onOpenChange={changeOpen}
      disabled={disabled || saving}
      title={t('确定删除 Redis 键「{value1}」？', { value1: item.name })}
      description={<ErrorNotice error={error ? t(error) : undefined} />}
      okButtonProps={{ danger: true, loading: saving }}
      cancelButtonProps={{ disabled: saving }}
      onConfirm={async () => {
        if (await onDelete(item)) changeOpen(false)
      }}
      onCancel={() => changeOpen(false)}
    >
      {children}
    </DeleteConfirmation>
  )
}
