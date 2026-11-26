import { Think } from '@ant-design/x'
import { theme } from 'antd'
import type { ReactNode } from 'react'

import { DeepSeekLogo } from '../deepseekLogo'

interface Props {
  title: string
  expanded: boolean
  onExpand: (open: boolean) => void
  children: ReactNode
  icon?: ReactNode
}
export function ProcessCard({ title, expanded, onExpand, children, icon }: Props) {
  const { token } = theme.useToken()
  return (
    <Think
      icon={icon ?? <DeepSeekLogo size={token.fontSize} />}
      title={title}
      expanded={expanded}
      onExpand={onExpand}
      styles={{
        root: { minWidth: 0 },
        status: { maxWidth: '100%', minHeight: token.controlHeight },
        content: { marginBlockStart: token.marginXS, minWidth: 0 }
      }}
    >
      {children}
    </Think>
  )
}
