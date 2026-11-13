import { SettingOutlined } from '@ant-design/icons'
import { Button, Modal, theme, Typography } from 'antd'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences } from '@/typings/theme'

import AISettings from '../aiSettings'
import About from './components/about'
import AppearanceCards from './components/appearanceCards'
import ThemePreview from './components/themePreview'
import { fontSizeOptions, languageOptions, settingsGroups, settingsLayout, SettingsSection, settingsSections, themeOptions } from './constant/settings'
import { useSystemSettings } from './hooks/useSystemSettings'

export default function SystemSettings(preferences: AppearancePreferences) {
  const { t } = useTranslation()

  const settings = useSystemSettings(preferences)
  const { token } = theme.useToken()
  const sectionTitle = t(settingsSections.find((section) => section.value === settings.section)?.label ?? '')
  return (
    <>
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
      <Modal
        title={t('系统设置')}
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
            {t('取消')}
          </Button>,
          <Button key="save" type="default" loading={settings.busy} disabled={!settings.canSave} onClick={() => void settings.save()}>
            {t('保存')}
          </Button>
        ]}
      >
        <div style={{ display: 'flex', height: `min(${settingsLayout.height}px, calc(100dvh - 180px))`, minHeight: 0, overflow: 'hidden', background: token.colorBgContainer }}>
          <nav
            aria-label={t('设置分类')}
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
              <div key={group.label} role="group" aria-label={t(group.label)} style={{ display: 'flex', flexDirection: 'column', gap: token.marginXXS, flexShrink: 0 }}>
                <Typography.Text type="secondary" style={{ paddingInline: token.padding, marginBottom: token.marginXXS }}>
                  {t(group.label)}
                </Typography.Text>
                {group.sections.map((section) => (
                  <Button
                    key={section.value}
                    type="text"
                    className="settings-section-choice"
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
                      whiteSpace: 'normal'
                    }}
                  >
                    {t(section.label)}
                  </Button>
                ))}
              </div>
            ))}
          </nav>
          <section aria-label={sectionTitle} style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', padding: token.paddingLG }}>
            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: token.marginLG }}>
              {sectionTitle}
            </Typography.Title>
            <ErrorNotice error={settings.error} style={{ marginBottom: token.margin }} />
            {settings.section === SettingsSection.Model && <AISettings model={settings.ai} disabled={settings.busy} />}
            {settings.section === SettingsSection.About && <About disabled={settings.busy} />}
            {settings.section === SettingsSection.Appearance && (
              <>
                <Typography.Text strong style={{ display: 'block', marginBottom: token.marginSM }}>
                  {t('主题模式')}
                </Typography.Text>
                <AppearanceCards
                  label={t('主题模式')}
                  value={settings.draftTheme}
                  onChange={settings.setDraftTheme}
                  disabled={settings.busy}
                  options={themeOptions.map((option) => ({ ...option, label: t(option.label), preview: <ThemePreview preference={option.value} /> }))}
                />
                <div style={{ marginTop: token.marginLG }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: token.marginSM }}>
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
