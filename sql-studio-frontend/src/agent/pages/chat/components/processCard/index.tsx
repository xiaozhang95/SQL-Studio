import { Think } from '@ant-design/x'
import { Flex, theme } from 'antd'
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
    <Flex align="start">
      <Think
        icon={icon ?? <DeepSeekLogo size={token.fontSize} />}
        title={title}
        expanded={expanded}
        onExpand={onExpand}
        styles={{
          root: {
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            borderRadius: token.borderRadiusLG,
            background: 'var(--surface-subtle)',
            boxShadow: 'var(--shadow-xs)'
          },
          content: { marginInlineStart: 0, marginBlockStart: 0, padding: token.paddingSM, borderInlineStart: 0 }
        }}
      >
        <div style={{ minWidth: 0 }}>{children}</div>
      </Think>
    </Flex>
  )
}
