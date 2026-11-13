import { App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { lazy, Suspense, useMemo } from 'react'

import SidebarWidthProvider from '@/components/sidebarWidthProvider'
import { appearance, modalDefaults } from '@/constant/appearance'
import { createThemeConfig } from '@/constant/theme'
import { useAppSection } from '@/hooks/useAppSection'
import { useThemePreference } from '@/hooks/useThemePreference'
import Workspace from '@/pages/workspace'

const AgentPage = lazy(() => import('@/pages/agent'))

/** 动态弹框使用 AntApp 上下文，确保亮暗主题一致。 */
export default function App() {
  const section = useAppSection()
  const { preference, fontSizePreference, savePreferences, mode, error, ready, saving } = useThemePreference()
  const themeConfig = useMemo(() => createThemeConfig(mode, fontSizePreference), [mode, fontSizePreference])
  const appearancePreferences = {
    themePreference: preference,
    fontSizePreference,
    onAppearanceSave: savePreferences,
    themeReady: ready
  }
  return (
    <ConfigProvider locale={zhCN} componentSize={appearance.controlSize} modal={modalDefaults} tag={{ variant: 'solid' }} theme={themeConfig}>
      <AntApp message={{ styles: { root: { display: 'none' } } }}>
        <SidebarWidthProvider>
          <div style={{ display: section.agent ? 'none' : undefined }}>
            <Workspace active={!section.agent} onOpenAgent={section.openAgent} {...appearancePreferences} themeSaving={saving} themeError={error} themeMode={mode} />
          </div>
          {section.agent && (
            <Suspense fallback={null}>
              <AgentPage onBack={section.openWorkspace} themeMode={mode} themeError={error} {...appearancePreferences} />
            </Suspense>
          )}
        </SidebarWidthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
