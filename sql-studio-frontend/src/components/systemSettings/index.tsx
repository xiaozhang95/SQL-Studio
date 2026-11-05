import { BgColorsOutlined, CheckOutlined, DesktopOutlined, DownOutlined, MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Flex, theme } from 'antd'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { getAIAdapter } from '@/ai'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

import AISettings from '../aiSettings'
import { useConnectionStatus } from './hooks/useConnectionStatus'

interface Props {
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
  themeReady?: boolean
}

const connectionStatuses = {
  checking: { status: 'processing', label: '检测中' },
  unconfigured: { status: 'default', label: '未配置' },
  connected: { status: 'success', label: '已连接' },
  failed: { status: 'error', label: '检测失败' }
} as const

export default function SystemSettings({ themeMode, themePreference, onThemeChange, themeReady = true }: Props) {
  const [open, setOpen] = useState(false)
  const { status: connection, check } = useConnectionStatus(open)
  const { token } = theme.useToken()
  const { profile } = getAIAdapter()
  const { status, label } = connectionStatuses[connection]

  const logo = themeMode === 'dark' ? profile.darkIcon : profile.icon
  const menuIcon = (icon: ReactNode) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: token.fontSize,
        minWidth: token.fontSize,
        height: token.fontSize,
        fontSize: token.fontSize,
        color: 'inherit'
      }}
    >
      {icon}
    </span>
  )
  const menuLabel = (label: string) => <span style={{ color: 'inherit' }}>{label}</span>
  const themeLabel = (value: ThemePreference, label: string) => (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: token.marginLG, color: 'inherit' }}>
      {label}
      {themePreference === value && <CheckOutlined />}
    </span>
  )
  return (
    <AISettings
      themeMode={themeMode}
      trigger={(show) => (
        <Dropdown
          placement="bottomRight"
          classNames={{ root: 'system-settings-menu' }}
          styles={{ root: { minWidth: 208 } }}
          trigger={['click']}
          autoFocus
          open={open}
          onOpenChange={(visible) => {
            setOpen(visible)
            if (visible) void check()
          }}
          menu={{
            selectable: false,
            expandIcon: () => null,
            items: [
              {
                key: 'deepseek',
                icon: menuIcon(
                  <span
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      background: 'currentColor',
                      maskImage: 'url("' + logo + '")',
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center'
                    }}
                  />
                ),
                label: (
                  <Flex align="center" justify="space-between" gap="small" flex={1}>
                    <span>DeepSeek</span>
                    <span aria-live="polite">
                      <Badge status={status} text={label} />
                    </span>
                  </Flex>
                )
              },
              { type: 'divider' },
              {
                key: 'appearance',
                popupClassName: 'system-settings-menu',
                icon: menuIcon(<BgColorsOutlined />),
                label: menuLabel('外观'),
                disabled: !themeReady,
                children: [
                  { key: 'system', icon: menuIcon(<DesktopOutlined />), label: themeLabel('system', '跟随系统') },
                  { key: 'light', icon: menuIcon(<SunOutlined />), label: themeLabel('light', '亮色模式') },
                  { key: 'dark', icon: menuIcon(<MoonOutlined />), label: themeLabel('dark', '暗色模式') }
                ]
              }
            ],
            onClick: ({ key }) => {
              setOpen(false)
              if (key === 'deepseek') void show()
              else if (themeReady && (key === 'system' || key === 'light' || key === 'dark')) onThemeChange(key)
            }
          }}
        >
          <Button aria-haspopup="menu" aria-expanded={open} icon={<SettingOutlined aria-hidden="true" />}>
            系统设置
            <DownOutlined aria-hidden="true" className="dropdown-chevron" />
          </Button>
        </Dropdown>
      )}
    />
  )
}
