import { SearchOutlined } from '@ant-design/icons'
import { Flex, Input, Tag, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

export function SidebarHeader({ title, count, actions }: { title: string; count: number; actions: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <Flex align="center" gap="small" style={{ flex: 'none', minHeight: 42, paddingInline: token.padding, borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}` }}>
      <Typography.Text strong>{title}</Typography.Text>
      <Tag style={{ marginInlineEnd: 0 }}>{count}</Tag>
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
        height: 42,
        paddingInline: token.padding,
        borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}`
      }}
    >
      <Input style={{ width: '100%' }} prefix={<SearchOutlined />} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} allowClear />
    </div>
  )
}
