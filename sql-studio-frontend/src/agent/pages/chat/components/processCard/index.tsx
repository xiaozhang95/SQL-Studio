import { Think } from '@ant-design/x'
import { Flex, theme } from 'antd'
import type { ReactNode } from 'react'

import ContentCard from '@/components/contentCard'

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
        styles={{ root: { flex: 1, minWidth: 0 }, content: { marginInlineStart: 0, marginBlockStart: token.marginXS, padding: 0, borderInlineStart: 0 } }}
      >
        <ContentCard>{children}</ContentCard>
      </Think>
    </Flex>
  )
}
