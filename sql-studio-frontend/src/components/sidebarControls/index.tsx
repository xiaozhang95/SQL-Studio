import { SearchOutlined } from '@ant-design/icons'
import { Flex, Input, Tag, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

import { appearance } from '@/constant/appearance'

export function SidebarHeader({ title, count, actions, detail }: { title: string; count: number; actions: ReactNode; detail?: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <Flex
      align="center"
      gap={token.marginXS}
      style={{ flex: 'none', minHeight: appearance.panelHeaderHeight, paddingInline: token.padding, borderBlockEnd: `${token.lineWidth}px solid var(--layout-divider)` }}
    >
      <Typography.Text strong>{title}</Typography.Text>
      <Tag style={{ marginInlineEnd: 0 }}>{count}</Tag>
      {detail}
      <Flex align="center" gap={token.marginXXS} style={{ marginInlineStart: 'auto' }}>
        {actions}
      </Flex>
    </Flex>
  )
}

export function SidebarSearch({ value, onChange, placeholder, label = placeholder }: { value: string; onChange: (value: string) => void; placeholder: string; label?: string }) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        height: appearance.panelHeaderHeight,
        paddingInline: token.padding,
        borderBlockEnd: `${token.lineWidth}px solid var(--layout-divider)`
      }}
    >
      <Input style={{ width: '100%' }} prefix={<SearchOutlined />} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} allowClear />
    </div>
  )
}
