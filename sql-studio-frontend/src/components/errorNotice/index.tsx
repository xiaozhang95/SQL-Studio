import { Alert } from 'antd'
import type { CSSProperties, ReactNode } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

interface Props {
  error?: string
  errors?: readonly (string | undefined)[]
  title?: string
  action?: ReactNode
  onClose?: () => void
  style?: CSSProperties
}

/** 全局错误展示入口，去重原因并使用相同的图标、颜色和关闭方式。 */
export default function ErrorNotice({ error, errors = [], title, action, onClose, style }: Props) {
  const { t } = useTranslation()
  const details = [...new Set([error, ...errors].filter((value): value is string => Boolean(value?.trim())).map((value) => t(value)))].join('\n')
  if (!details) return null
  const content = <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{details}</div>
  return (
    <Alert
      key={`${title ?? ''}\n${details}`}
      type="error"
      showIcon
      closable
      title={title ? t(title) : content}
      description={title ? content : undefined}
      action={action}
      onClose={onClose}
      style={{ flexShrink: 0, ...style }}
    />
  )
}
