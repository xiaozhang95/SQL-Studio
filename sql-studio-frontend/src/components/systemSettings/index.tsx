import { DesktopOutlined, MoonOutlined, SettingOutlined, SunOutlined } from '@ant-design/icons'
import { Button, Divider, Dropdown, Flex, Segmented, theme, Tooltip, Typography } from 'antd'
import { useId, useState } from 'react'

import type { AppearancePreferences, FontSizePreference, ThemeMode, ThemePreference } from '@/typings/theme'

import AISettings from '../aiSettings'

interface Props extends AppearancePreferences {
  themeMode: ThemeMode
}

export default function SystemSettings({ themeMode, themePreference, onThemeChange, fontSizePreference, onFontSizeChange, themeReady = true }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const labelId = useId()
  const { token } = theme.useToken()

  return (
    <Dropdown
      placement="bottomRight"
      styles={{ root: { width: 400, maxWidth: 'calc(100vw - 24px)' } }}
      trigger={['click']}
      autoFocus
      open={open}
      onOpenChange={(next) => {
        if (!busy) setOpen(next)
      }}
      popupRender={() => (
        <div
          role="dialog"
          aria-label="系统设置"
          style={{
            padding: token.paddingSM,
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadowSecondary,
            maxHeight: 'calc(100dvh - 72px)',
            overflowY: 'auto'
          }}
        >
          {open && (
            <Flex vertical gap="small">
              <Typography.Text id={labelId + '-model'}>模型配置</Typography.Text>
              <AISettings themeMode={themeMode} onDone={() => setOpen(false)} onBusyChange={setBusy} />
            </Flex>
          )}
          <Divider style={{ marginBlock: token.marginSM }} />
          <Flex vertical gap="middle">
            <Flex vertical gap="small">
              <Typography.Text id={labelId + '-theme'}>主题模式</Typography.Text>
              <Segmented<ThemePreference>
                block
                aria-labelledby={labelId + '-theme'}
                disabled={!themeReady}
                value={themePreference}
                onChange={onThemeChange}
                options={[
                  { value: 'system', icon: <DesktopOutlined />, label: '跟随系统' },
                  { value: 'light', icon: <SunOutlined />, label: '亮色' },
                  { value: 'dark', icon: <MoonOutlined />, label: '暗色' }
                ]}
              />
            </Flex>
            <Flex vertical gap="small">
              <Typography.Text id={labelId + '-font-size'}>界面字号</Typography.Text>
              <Segmented<FontSizePreference>
                block
                aria-labelledby={labelId + '-font-size'}
                disabled={!themeReady}
                value={fontSizePreference}
                onChange={onFontSizeChange}
                options={[
                  { value: 'small', label: '较小' },
                  { value: 'standard', label: '标准' },
                  { value: 'large', label: '稍大' }
                ]}
              />
            </Flex>
          </Flex>
        </div>
      )}
    >
      <Tooltip title={open ? null : '系统设置'}>
        <Button type="text" aria-label="系统设置" aria-haspopup="dialog" aria-expanded={open} icon={<SettingOutlined aria-hidden="true" />} />
      </Tooltip>
    </Dropdown>
  )
}
