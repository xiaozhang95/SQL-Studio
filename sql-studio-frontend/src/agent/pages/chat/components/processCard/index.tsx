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
        classNames={{ content: 'chat-process-content' }}
        styles={{ root: { flex: 1, minWidth: 0 } }}
      >
        <Card size="small" className="content-frame">{children}</Card>
      </Think>
    </Flex>
  )
}
