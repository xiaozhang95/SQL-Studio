import { CheckOutlined, DesktopOutlined, MoonOutlined, SettingOutlined, SkinOutlined, SunOutlined } from '@ant-design/icons'
import { Button, Dropdown, theme } from 'antd'
import type { ReactNode } from 'react'

import { getAIAdapter } from '@/ai'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

import AISettings from '../aiSettings'

interface Props {
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
  themeReady?: boolean
}

export default function SystemSettings({ themeMode, themePreference, onThemeChange, themeReady = true }: Props) {
  const { token } = theme.useToken()
  const profile = getAIAdapter().profile
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
    <div
      style={{
        flexShrink: 0,
        height: token.controlHeight + token.paddingXS * 2 + token.lineWidth,
        paddingBlock: token.paddingXXS,
        paddingInline: 'var(--workspace-inset)',
        paddingTop: token.paddingXXS + token.lineWidth
      }}
    >
      <AISettings
        themeMode={themeMode}
        trigger={(show) => (
          <Dropdown
            placement="topLeft"
            classNames={{ root: 'system-settings-menu' }}
            trigger={['click']}
            styles={{
              itemContent: { display: 'flex', alignItems: 'center', flex: 1 }
            }}
            menu={{
              selectable: false,
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
                  label: menuLabel('DeepSeek配置')
                },
                { type: 'divider' },
                {
                  key: 'appearance',
                  popupClassName: 'system-settings-menu',
                  icon: menuIcon(<SkinOutlined />),
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
                if (key === 'deepseek') void show()
                else if (themeReady && (key === 'system' || key === 'light' || key === 'dark')) onThemeChange(key)
              }
            }}
          >
            <Button block icon={<SettingOutlined />} style={{ height: '100%', justifyContent: 'flex-start', paddingInline: token.paddingSM }}>
              系统设置
            </Button>
          </Dropdown>
        )}
      />
    </div>
  )
}
