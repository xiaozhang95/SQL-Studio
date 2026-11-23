import type { ReactNode } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { usePageErrors } from '@/contexts/pageErrors'

interface Props {
  errors?: readonly (string | undefined)[]
  errorAction?: ReactNode
  onErrorClose?: () => void
  errorScope?: string
}

/** 页面顶部的错误通栏，汇总各内容区登记的原因。 */
export default function PageErrorBanner({ errors = [], errorAction, onErrorClose, errorScope }: Props) {
  const pageErrors = usePageErrors()
  return (
    <div style={{ flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}>
      <ErrorNotice
        key={errorScope}
        banner
        errors={[...errors, ...(pageErrors?.errors ?? [])]}
        action={errorAction}
        onClose={() => {
          pageErrors?.clearErrors()
          onErrorClose?.()
        }}
      />
    </div>
  )
}
