import { CheckOutlined, CommentOutlined, DatabaseOutlined, DesktopOutlined, DownOutlined, MoonOutlined, SettingOutlined, SkinOutlined, SunOutlined, UpOutlined } from '@ant-design/icons'
import { Badge, Button, Dropdown, Flex, theme } from 'antd'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { getAIAdapter } from '@/ai'
import type { AIConfigDocument } from '@/ai/typings'
import type { ThemeMode, ThemePreference } from '@/typings/theme'
import { request } from '@/utils/request'

import AISettings from '../aiSettings'

interface Props {
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
  themeReady?: boolean
  navigation: { destination: 'agent' | 'workspace'; onSelect: () => void; disabled?: boolean }
}

const connectionStatuses = {
  checking: { status: 'processing', label: '检测中' },
  unconfigured: { status: 'default', label: '未配置' },
  connected: { status: 'success', label: '已连接' },
  failed: { status: 'error', label: '检测失败' }
} as const

export default function SystemSettings({ themeMode, themePreference, onThemeChange, themeReady = true, navigation }: Props) {
  const [open, setOpen] = useState(false)
  const [connection, setConnection] = useState<keyof typeof connectionStatuses>('checking')
  const { token } = theme.useToken()
  const TriggerArrow = open ? UpOutlined : DownOutlined
  const { profile } = getAIAdapter()
  const opensAgent = navigation.destination === 'agent'
  const { status, label } = connectionStatuses[connection]

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const { signal } = controller
    const checkConnection = async () => {
      try {
        const config = await request<AIConfigDocument>('/state/ai', { signal })
        if (signal.aborted) return
        if (!config.data?.configured) {
          setConnection('unconfigured')
          return
        }
        await getAIAdapter().listModels('', signal)
        if (!signal.aborted) setConnection('connected')
      } catch {
        if (!signal.aborted) setConnection('failed')
      }
    }
    void checkConnection()
    return () => controller.abort()
  }, [open])

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
            autoFocus
            open={open}
            onOpenChange={(visible) => {
              if (visible) setConnection('checking')
              setOpen(visible)
            }}
            menu={{
              selectable: false,
              items: [
                {
                  key: 'switch-page',
                  icon: menuIcon(opensAgent ? <CommentOutlined /> : <DatabaseOutlined />),
                  label: menuLabel(opensAgent ? 'Agent' : '工作区'),
                  disabled: navigation.disabled
                },
                { type: 'divider' },
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
                      <span>DeepSeek 配置</span>
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
                setOpen(false)
                if (key === 'switch-page') navigation.onSelect()
                else if (key === 'deepseek') void show()
                else if (themeReady && (key === 'system' || key === 'light' || key === 'dark')) onThemeChange(key)
              }
            }}
          >
            <Button block aria-haspopup="menu" aria-expanded={open} icon={<SettingOutlined />} style={{ height: '100%', justifyContent: 'flex-start', paddingInline: token.paddingSM }}>
              <Flex align="center" justify="space-between" flex={1}>
                系统设置
                <TriggerArrow aria-hidden="true" className="dropdown-chevron" />
              </Flex>
            </Button>
          </Dropdown>
        )}
      />
    </div>
  )
}
