import { Think } from '@ant-design/x'
import { Card, Flex, theme } from 'antd'
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
        styles={{ root: { flex: 1, minWidth: 0 }, content: { marginInlineStart: 0, marginTop: token.marginXS, padding: 0, borderInlineStart: 0 } }}
      >
        {expanded ? <Card size="small">{children}</Card> : null}
      </Think>
    </Flex>
  )
}
