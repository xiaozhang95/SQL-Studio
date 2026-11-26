import { SearchOutlined } from '@ant-design/icons'
import { Flex, Input, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

import { appearance, panelHeaderRowStyle } from '@/constant/appearance'

export function SidebarHeader({ title, actions, detail }: { title: string; actions: ReactNode; detail?: ReactNode }) {
  const { token } = theme.useToken()
  return (
    <Flex
      align="center"
      gap={token.marginXS}
      style={{ ...panelHeaderRowStyle, flex: 'none', paddingInline: token.padding }}
    >
      <Typography.Text strong>{title}</Typography.Text>
      {detail}
      <Flex align="center" gap={token.marginXXS} style={{ marginInlineStart: 'auto' }}>
        {actions}
      </Flex>
    </Flex>
  )
}

type SearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label?: string
  disabled?: boolean
  maxLength?: number
}

export function SidebarSearch({ value, onChange, placeholder, label = placeholder, disabled, maxLength }: SearchProps) {
  const { token } = theme.useToken()
  return (
    <div
      style={{
        ...panelHeaderRowStyle,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        height: appearance.panelHeaderHeight,
        paddingInline: token.padding
      }}
    >
      <Input
        style={{ width: '100%' }}
        prefix={<SearchOutlined />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
        maxLength={maxLength}
        allowClear
      />
    </div>
  )
}
