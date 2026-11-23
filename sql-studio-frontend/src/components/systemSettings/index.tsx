import { SettingOutlined } from '@ant-design/icons'
import { Button, Modal, theme, Tooltip, Typography } from 'antd'

import StudioIcon from '@/components/studioIcon'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences } from '@/typings/theme'

import AISettings from '../aiSettings'
import About from './components/about'
import AppearanceCards from './components/appearanceCards'
import ThemePreview from './components/themePreview'
import { fontSizeOptions, languageOptions, settingsGroups, settingsLayout, SettingsSection, settingsSections, themeOptions } from './constant/settings'
import { useSystemSettings } from './hooks/useSystemSettings'

export default function SystemSettings({ variant = 'default', ...preferences }: AppearancePreferences & { variant?: 'default' | 'rail' }) {
  const { t } = useTranslation()

  const settings = useSystemSettings(preferences)
  const { token } = theme.useToken()
  const sectionTitle = t(settingsSections.find((section) => section.value === settings.section)?.label ?? '')
  return (
    <>
      {variant === 'rail' ? (
        <Tooltip title={t('系统设置')} placement="right">
          <Button
            type="text"
            className="app-rail-button"
            aria-label={t('系统设置')}
            aria-haspopup="dialog"
            aria-expanded={settings.open}
            icon={<StudioIcon name="sliders" size={20} />}
            disabled={preferences.themeReady === false}
            onClick={settings.show}
          />
        </Tooltip>
      ) : (
        <Button
          type="text"
          aria-label={t('系统设置')}
          aria-haspopup="dialog"
          aria-expanded={settings.open}
          icon={<SettingOutlined aria-hidden="true" />}
          disabled={preferences.themeReady === false}
          onClick={settings.show}
        >
          {t('系统设置')}
        </Button>
      )}
      <Modal
        rootClassName="sql-studio-theme"
        title={t('系统设置')}
        width={settingsLayout.width}
        open={settings.open}
        onCancel={settings.close}
        closable={!settings.busy}
        mask={{ closable: !settings.busy }}
        keyboard={!settings.busy}
        destroyOnHidden
        styles={{
          container: { padding: 0, overflow: 'hidden', borderRadius: 12 },
          header: {
            margin: 0,
            height: 52,
            padding: '0 16px 0 20px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${token.colorBorderSecondary}`
          },
          body: { padding: 0 },
          footer: {
            margin: 0,
            height: 56,
            padding: '0 16px 0 20px',
            display: 'flex',
            alignItems: 'center',
            borderTop: `1px solid ${token.colorBorderSecondary}`
          }
        }}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
            <Button disabled={settings.busy} onClick={settings.close}>
              {t('取消')}
            </Button>
            <Button type="primary" loading={settings.busy} disabled={!settings.canSave} onClick={() => void settings.save()}>
              {t('保存')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', height: `min(${settingsLayout.height}px, calc(100dvh - 240px))`, minHeight: 0, overflow: 'hidden', background: token.colorBgContainer }}>
          <nav
            aria-label={t('设置分类')}
            style={{
              width: settingsLayout.sidebarWidth,
              flex: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '14px 10px',
              borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
              overflowY: 'auto'
            }}
          >
            {settingsGroups.map((group) => (
              <div key={group.label} role="group" aria-label={t(group.label)} style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                <Typography.Text strong style={{ padding: '4px 10px 6px', color: token.colorText }}>
                  {t(group.label)}
                </Typography.Text>
                {group.sections.map((section) => {
                  const active = settings.section === section.value
                  return (
                    <Button
                      key={section.value}
                      type="text"
                      className="settings-section-choice"
                      icon={<section.icon style={{ fontSize: 16 }} aria-hidden="true" />}
                      aria-pressed={active}
                      disabled={settings.busy}
                      onClick={() => settings.setSection(section.value)}
                      style={{
                        height: 40,
                        minHeight: 40,
                        flexShrink: 0,
                        gap: 10,
                        paddingInline: 10,
                        borderRadius: 8,
                        justifyContent: 'flex-start',
                        textAlign: 'start',
                        whiteSpace: 'normal',
                        color: 'var(--text)'
                      }}
                    >
                      {t(section.label)}
                    </Button>
                  )
                })}
              </div>
            ))}
          </nav>
          <section aria-label={sectionTitle} style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: '20px 24px' }}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 20 }}>
              {sectionTitle}
            </Typography.Title>
            {settings.section === SettingsSection.Model && <AISettings model={settings.ai} disabled={settings.busy} />}
            {settings.section === SettingsSection.About && <About disabled={settings.busy} />}
            {settings.section === SettingsSection.Appearance && (
              <>
                <Typography.Text strong style={{ display: 'block', marginBottom: 9 }}>
                  {t('主题模式')}
                </Typography.Text>
                <AppearanceCards
                  label={t('主题模式')}
                  value={settings.draftTheme}
                  onChange={settings.setDraftTheme}
                  disabled={settings.busy}
                  options={themeOptions.map((option) => ({ ...option, label: t(option.label), preview: <ThemePreview preference={option.value} /> }))}
                />
                <div style={{ marginTop: 22 }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 9 }}>
                    {t('界面字号')}
                  </Typography.Text>
                  <AppearanceCards
                    label={t('界面字号')}
                    value={settings.draftFontSize}
                    onChange={settings.setDraftFontSize}
                    disabled={settings.busy}
                    options={fontSizeOptions.map((option) => ({
                      ...option,
                      label: t(option.label),
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
                          <span>{t('数据查询')}</span>
                        </div>
                      )
                    }))}
                  />
                </div>
              </>
            )}
            {settings.section === SettingsSection.Language && (
              <AppearanceCards
                label={t('界面语言')}
                value={settings.draftLanguage}
                onChange={settings.setDraftLanguage}
                disabled={settings.busy}
                options={languageOptions.map((option) => ({
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
                        background: token.colorFillAlter
                      }}
                    >
                      <Typography.Text strong>{option.heading}</Typography.Text>
                      <Typography.Text type="secondary">{option.sample}</Typography.Text>
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
