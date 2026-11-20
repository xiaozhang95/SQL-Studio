import { Modal } from 'antd'
import type { ReactNode } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

type Props = {
  open: boolean
  title: ReactNode
  children?: ReactNode
  busy?: boolean
  disabled?: boolean
  resultOnly?: boolean
  confirmText?: string
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteDialog({ open, title, children, busy = false, disabled = false, resultOnly = false, confirmText, onCancel, onConfirm }: Props) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      onOk={resultOnly ? onCancel : onConfirm}
      okText={resultOnly ? t('关闭') : (confirmText ?? t('删除'))}
      cancelText={t('取消')}
      confirmLoading={busy}
      closable={!busy}
      mask={{ closable: !busy }}
      keyboard={!busy}
      okButtonProps={{ danger: !resultOnly, disabled: busy || (!resultOnly && disabled) }}
      cancelButtonProps={{ disabled: busy }}
      footer={resultOnly ? (_, { OkBtn }) => <OkBtn /> : undefined}
      styles={{ title: { overflowWrap: 'anywhere' }, body: { maxHeight: '55dvh', overflowY: 'auto', overflowWrap: 'anywhere' } }}
    >
      {children}
    </Modal>
  )
}
