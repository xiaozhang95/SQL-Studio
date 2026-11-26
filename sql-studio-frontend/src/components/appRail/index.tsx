import { Button, Divider, theme, Tooltip } from 'antd'
import { useState } from 'react'

import StudioIcon, { databaseSectionIconNames } from '@/components/studioIcon'
import SystemSettings from '@/components/systemSettings'
import { appearance, railButtonStyle } from '@/constant/appearance'
import { useNavigationLock } from '@/contexts/navigationLock'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import { useDesktopUpdates } from '@/hooks/useDesktopUpdates'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences, ThemeMode } from '@/typings/theme'

import UpdateIndicator from './components/updateIndicator'

export type AppSection = 'workspace' | 'agent' | 'monitor' | 'sync'

interface Props extends AppearancePreferences {
  section: AppSection
  themeMode: ThemeMode
  disabled?: boolean
  onOpenWorkspace: () => void
  onOpenAgent: () => void
  onOpenDatabaseSection: (section: DatabaseSection, scope?: DatabaseSectionScope) => void
}

/** 全局左侧导航：页面切换、主题切换与系统设置入口。 */
export default function AppRail({ section, themeMode, disabled = false, onOpenWorkspace, onOpenAgent, onOpenDatabaseSection, ...preferences }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { locked } = useNavigationLock()
  const updates = useDesktopUpdates()
  const navigationDisabled = disabled || locked
  const [savingTheme, setSavingTheme] = useState(false)
  const items = [
    { key: 'workspace', label: '工作区', icon: <StudioIcon name="database" size={appearance.railIconSize} />, onClick: onOpenWorkspace },
    { key: 'agent', label: 'AI 助手', icon: <StudioIcon name="bot" size={appearance.railIconSize} />, onClick: onOpenAgent },
    { key: 'monitor', label: '监控指标', icon: <StudioIcon name={databaseSectionIconNames.monitor} size={appearance.railIconSize} />, onClick: () => onOpenDatabaseSection('monitor') },
    { key: 'sync', label: '同步数据库', icon: <StudioIcon name={databaseSectionIconNames.sync} size={appearance.railIconSize} />, onClick: () => onOpenDatabaseSection('sync') }
  ] as const

  async function toggleTheme() {
    if (!preferences.themeReady || savingTheme) return
    setSavingTheme(true)
    try {
      await preferences.onAppearanceSave({
        theme: themeMode === 'dark' ? 'light' : 'dark',
        fontSize: preferences.fontSizePreference,
        language: preferences.language ?? 'zh-CN'
      })
    } finally {
      setSavingTheme(false)
    }
  }

  return (
    <aside
      className="app-rail"
      aria-label={t('工作区')}
      style={{
        display: 'flex',
        flex: 'none',
        flexDirection: 'column',
        alignItems: 'center',
        gap: token.marginXXS,
        paddingBlock: token.paddingSM,
        borderInlineEnd: `${token.lineWidth}px solid var(--layout-divider)`,
        background: token.colorBgContainer,
        color: token.colorTextSecondary,
        userSelect: 'none'
      }}
    >
      <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: token.marginXXS, width: '100%' }} aria-label={t('工作区')}>
        {items.map((item) => (
          <Tooltip key={item.key} title={navigationDisabled ? t('请等待当前操作完成') : t(item.label)} placement="right">
            <Button
              type="text"
              className="app-rail-button"
              style={
                section === item.key
                  ? {
                      ...railButtonStyle,
                      backgroundColor: 'var(--surface-selected)',
                      color: navigationDisabled ? token.colorTextDisabled : 'var(--navigation-icon-selected)'
                    }
                  : railButtonStyle
              }
              icon={item.icon}
              aria-label={t(item.label)}
              aria-current={section === item.key ? 'page' : undefined}
              disabled={navigationDisabled}
              onClick={item.onClick}
            />
          </Tooltip>
        ))}
      </nav>
      <div style={{ flex: 1 }} />
      <UpdateIndicator updates={updates} disabled={disabled} />
      <Divider style={{ width: token.controlHeightSM, minWidth: 0, marginBlock: token.marginXXS }} />
      <Tooltip title={t('切换主题')} placement="right">
        <Button
          type="text"
          className="app-rail-button"
          style={railButtonStyle}
          icon={<StudioIcon name={themeMode === 'dark' ? 'sun' : 'moon'} size={appearance.railIconSize} />}
          aria-label={t('切换主题')}
          loading={savingTheme}
          disabled={!preferences.themeReady}
          onClick={() => void toggleTheme()}
        />
      </Tooltip>
      <SystemSettings variant="rail" updates={updates} {...preferences} themeReady={preferences.themeReady} />
    </aside>
  )
}
