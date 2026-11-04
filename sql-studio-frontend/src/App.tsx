import { App as AntApp, ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { lazy, Suspense } from 'react'

import SidebarWidthProvider from '@/components/sidebarWidthProvider'
import { appearance } from '@/constant/appearance'
import { useAppSection } from '@/hooks/useAppSection'
import { useThemePreference } from '@/hooks/useThemePreference'
import Workspace from '@/pages/workspace'

const AgentPage = lazy(() => import('@/pages/agent'))

/** 动态弹框使用 AntApp 上下文，确保亮暗主题一致。 */
export default function App() {
  const section = useAppSection()
  const { preference, setPreference, mode, error, ready, saving } = useThemePreference()
  return (
    <ConfigProvider
      locale={zhCN}
      componentSize={appearance.controlSize}
      tag={{ variant: 'solid' }}
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        cssVar: { key: 'sql-studio-theme' }
      }}
    >
      <AntApp message={{ styles: { root: { display: 'none' } } }}>
        <SidebarWidthProvider>
          <div style={{ display: section.agent ? 'none' : undefined }}>
            <Workspace onOpenAgent={section.openAgent} themeReady={ready} themeSaving={saving} themeError={error} themeMode={mode} themePreference={preference} onThemeChange={setPreference} />
          </div>
          {section.agent && (
            <Suspense fallback={null}>
              <AgentPage onBack={section.openWorkspace} themeMode={mode} themePreference={preference} onThemeChange={setPreference} />
            </Suspense>
          )}
        </SidebarWidthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
