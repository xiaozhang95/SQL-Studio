import { XProvider } from '@ant-design/x'
import xEnUS from '@ant-design/x/locale/en_US'
import xZhCN from '@ant-design/x/locale/zh_CN'
import { App as AntApp } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { lazy, Suspense, useMemo } from 'react'

import ContentLoading from '@/components/contentLoading'
import SidebarWidthProvider from '@/components/sidebarWidthProvider'
import { appearance, modalDefaults } from '@/constant/appearance'
import { createThemeConfig } from '@/constant/theme'
import { LanguageContext } from '@/contexts/language'
import { useAppSection } from '@/hooks/useAppSection'
import { useThemePreference } from '@/hooks/useThemePreference'
import Workspace from '@/pages/workspace'
import { translate } from '@/utils/translate'

const AgentPage = lazy(() => import('@/pages/agent'))

/** 动态弹框使用 AntApp 上下文，确保亮暗主题一致。 */
export default function App() {
  const section = useAppSection()
  const { preference, fontSizePreference, language, savePreferences, mode, ready, saving } = useThemePreference()
  const themeConfig = useMemo(() => createThemeConfig(mode, fontSizePreference), [mode, fontSizePreference])
  const locale = useMemo(() => (language === 'en-US' ? { ...enUS, ...xEnUS } : { ...zhCN, ...xZhCN }), [language])
  const appearancePreferences = {
    themePreference: preference,
    fontSizePreference,
    language,
    onAppearanceSave: savePreferences,
    themeReady: ready
  }
  return (
    <LanguageContext.Provider value={language}>
      <XProvider locale={locale} componentSize={appearance.controlSize} modal={modalDefaults} tag={{ variant: 'solid' }} theme={themeConfig}>
        <AntApp message={{ styles: { root: { display: 'none' } } }}>
          {ready ? (
            <SidebarWidthProvider>
              <div style={{ display: section.agent ? 'none' : undefined }}>
                <Workspace active={!section.agent} onOpenAgent={section.openAgent} {...appearancePreferences} themeSaving={saving} themeMode={mode} />
              </div>
              {section.agent && (
                <Suspense fallback={null}>
                  <AgentPage onBack={section.openWorkspace} themeMode={mode} {...appearancePreferences} />
                </Suspense>
              )}
            </SidebarWidthProvider>
          ) : (
            <ContentLoading label={translate('正在读取界面设置…', language)} style={{ height: '100dvh' }} />
          )}
        </AntApp>
      </XProvider>
    </LanguageContext.Provider>
  )
}
