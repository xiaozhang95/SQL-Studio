import { SettingOutlined } from '@ant-design/icons'
import { Alert, Button, Modal, theme, Typography } from 'antd'

import type { AppearancePreferences, ThemeMode } from '@/typings/theme'

import AISettings from '../aiSettings'
import AppearanceCards from './components/appearanceCards'
import ThemePreview from './components/themePreview'
import { fontSizeOptions, settingsGroups, settingsLayout, SettingsSection, settingsSections, themeOptions } from './constant/settings'
import { useSystemSettings } from './hooks/useSystemSettings'

interface Props extends AppearancePreferences {
  themeMode: ThemeMode
}

export default function SystemSettings({ themeMode, ...preferences }: Props) {
  const settings = useSystemSettings(preferences)
  const { token } = theme.useToken()
  const sectionTitle = settingsSections.find((section) => section.value === settings.section)?.label
  return (
    <>
      <Button
        type="text"
        aria-label="系统设置"
        aria-haspopup="dialog"
        aria-expanded={settings.open}
        icon={<SettingOutlined aria-hidden="true" />}
        disabled={preferences.themeReady === false}
        onClick={settings.show}
      >
        系统设置
      </Button>
      <Modal
        title="系统设置"
        width={settingsLayout.width}
        open={settings.open}
        onCancel={settings.close}
        closable={!settings.busy}
        mask={{ closable: !settings.busy }}
        keyboard={!settings.busy}
        destroyOnHidden
        styles={{
          container: { padding: 0, overflow: 'hidden' },
          header: { margin: 0, padding: '20px 24px', borderBottom: `1px solid ${token.colorBorderSecondary}` },
          body: { padding: 0 },
          footer: { margin: 0, padding: '16px 24px', borderTop: `1px solid ${token.colorBorderSecondary}` }
        }}
        footer={[
          <Button key="cancel" disabled={settings.busy} onClick={settings.close}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={settings.busy} disabled={!settings.canSave} onClick={() => void settings.save()}>
            保存
          </Button>
        ]}
      >
        <div style={{ display: 'flex', height: `min(${settingsLayout.height}px, calc(100dvh - 180px))`, minHeight: 0, overflow: 'hidden', background: token.colorBgContainer }}>
          <nav
            aria-label="设置分类"
            style={{
              width: `clamp(120px, 24%, ${settingsLayout.sidebarWidth}px)`,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: token.marginLG,
              padding: `${token.paddingLG}px ${token.paddingSM}px`,
              borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
              overflowY: 'auto'
            }}
          >
            {settingsGroups.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXXS, flexShrink: 0 }}>
                <Typography.Text type="secondary" style={{ paddingInline: token.padding, marginBottom: token.marginXXS }}>
                  {group.label}
                </Typography.Text>
                {group.sections.map((section) => (
                  <Button
                    key={section.value}
                    type="text"
                    icon={<section.icon aria-hidden="true" />}
                    aria-pressed={settings.section === section.value}
                    disabled={settings.busy}
                    onClick={() => settings.setSection(section.value)}
                    style={{
                      height: 'auto',
                      minHeight: token.controlHeightLG,
                      flexShrink: 0,
                      justifyContent: 'flex-start',
                      textAlign: 'start',
                      whiteSpace: 'normal',
                      background: settings.section === section.value ? token.controlItemBgHover : undefined
                    }}
                  >
                    {section.label}
                  </Button>
                ))}
              </div>
            ))}
          </nav>
          <section aria-label={sectionTitle} style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: token.paddingLG }}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginLG }}>
              {sectionTitle}
            </Typography.Title>
            {settings.error && <Alert type="error" showIcon title={settings.error} style={{ marginBottom: token.margin }} />}
            {settings.section === SettingsSection.Model && <AISettings themeMode={themeMode} model={settings.ai} disabled={settings.busy} />}
            {settings.section === SettingsSection.Theme && (
              <AppearanceCards
                label="主题模式"
                value={settings.draftTheme}
                onChange={settings.setDraftTheme}
                disabled={settings.busy}
                options={themeOptions.map((option) => ({ ...option, preview: <ThemePreview preference={option.value} /> }))}
              />
            )}
            {settings.section === SettingsSection.FontSize && (
              <AppearanceCards
                label="界面字号"
                value={settings.draftFontSize}
                onChange={settings.setDraftFontSize}
                disabled={settings.busy}
                options={fontSizeOptions.map((option) => ({
                  ...option,
                  preview: (
                    <div
                      style={{
                        height: settingsLayout.previewHeight,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: token.marginXS,
                        borderRadius: token.borderRadiusSM,
                        background: token.colorFillAlter,
                        fontSize: option.fontSize
                      }}
                    >
                      <span>SQL Studio</span>
                      <span>数据查询</span>
                    </div>
                  )
                }))}
              />
            )}
          </section>
        </div>
      </Modal>
    </>
  )
}
