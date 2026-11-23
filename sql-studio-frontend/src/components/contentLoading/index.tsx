import { Flex, Spin } from 'antd'
import type { CSSProperties } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

export default function ContentLoading({ label, className, style }: { label: string; className?: string; style?: CSSProperties }) {
  const { t } = useTranslation()
  return (
    <Flex
      align="center"
      justify="center"
      role="status"
      className={className ? `content-loading ${className}` : 'content-loading'}
      style={{ width: '100%', height: '100%', flex: 1, minHeight: 0, ...style }}
    >
      <Spin description={t(label)} />
    </Flex>
  )
}
