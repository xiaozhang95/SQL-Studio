import { EyeInvisibleOutlined } from '@ant-design/icons'
import { Think } from '@ant-design/x'
import { Button, Card, Flex, theme, Tooltip } from 'antd'
import type { ReactNode } from 'react'

import { DeepSeekLogo } from '../deepseekLogo'

interface Props {
  title: string
  name: string
  expanded: boolean
  onExpand: (open: boolean) => void
  onHide: () => void
  children: ReactNode
}
export function ProcessCard({ title, name, expanded, onExpand, onHide, children }: Props) {
  const { token } = theme.useToken()
  return (
    <Card size="small" styles={{ body: { padding: token.paddingSM } }}>
      <Flex align="start" gap="small">
        <Think icon={<DeepSeekLogo />} title={title} expanded={expanded} onExpand={onExpand} styles={{ root: { flex: 1, minWidth: 0 }, content: { marginInlineStart: 0, padding: 0 } }}>
          {expanded ? children : null}
        </Think>
        <Tooltip title={'隐藏' + name}>
          <Button type="text" size="small" aria-label={'隐藏' + name} icon={<EyeInvisibleOutlined />} onClick={onHide} />
        </Tooltip>
      </Flex>
    </Card>
  )
}
