import { Button, Tooltip } from 'antd'
import { useState } from 'react'
import type { CSSProperties } from 'react'

import StudioIcon from '@/components/studioIcon'
import SystemSettings from '@/components/systemSettings'
import { railButtonStyle } from '@/constant/appearance'
import { useNavigationLock } from '@/contexts/navigationLock'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences, ThemeMode } from '@/typings/theme'

export type AppSection = 'workspace' | 'agent' | 'monitor' | 'sync'

const logoStyle = {
  width: 34,
  height: 34,
  marginBottom: 12,
  padding: 0,
  border: 0,
  borderRadius: 'var(--ant-border-radius-lg)',
  overflow: 'hidden'
} satisfies CSSProperties

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
  const { locked } = useNavigationLock()
  const navigationDisabled = disabled || locked
  const [savingTheme, setSavingTheme] = useState(false)
  const items = [
    { key: 'workspace', label: '工作区', icon: <StudioIcon name="database" size={20} />, onClick: onOpenWorkspace },
    { key: 'agent', label: 'AI 助手', icon: <StudioIcon name="bot" size={20} />, onClick: onOpenAgent },
    { key: 'monitor', label: '监控指标', icon: <StudioIcon name="activity" size={20} />, onClick: () => onOpenDatabaseSection('monitor') },
    { key: 'sync', label: '同步数据库', icon: <StudioIcon name="swap" size={20} />, onClick: () => onOpenDatabaseSection('sync') }
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
        gap: 4,
        padding: '10px 0 12px',
        borderInlineEnd: '1px solid var(--border)',
        background: 'var(--rail-surface)',
        userSelect: 'none'
      }}
    >
      <Tooltip title="SQL Studio" placement="right">
        <Button type="text" className="app-rail-logo" style={logoStyle} aria-label="SQL Studio" disabled={navigationDisabled} onClick={onOpenWorkspace}>
          <img src="/studio.svg" alt="" width={34} height={34} draggable={false} />
        </Button>
      </Tooltip>
      <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: '100%' }} aria-label={t('工作区')}>
        {items.map((item) => (
          <Tooltip key={item.key} title={navigationDisabled ? t('请等待当前操作完成') : t(item.label)} placement="right">
            <Button
              type="text"
              className="app-rail-button"
              style={railButtonStyle}
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
      <div style={{ width: 22, height: 1, marginBlock: 6, background: 'var(--border)' }} />
      <Tooltip title={t('切换主题')} placement="right">
        <Button
          type="text"
          className="app-rail-button"
          style={railButtonStyle}
          icon={<StudioIcon name={themeMode === 'dark' ? 'sun' : 'moon'} size={20} />}
          aria-label={t('切换主题')}
          loading={savingTheme}
          disabled={!preferences.themeReady}
          onClick={() => void toggleTheme()}
        />
      </Tooltip>
      <SystemSettings variant="rail" {...preferences} themeReady={preferences.themeReady} />
    </aside>
  )
}
