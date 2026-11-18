import { XProvider } from '@ant-design/x'
import xEnUS from '@ant-design/x/locale/en_US'
import xZhCN from '@ant-design/x/locale/zh_CN'
import { App as AntApp } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { lazy, Suspense, useMemo } from 'react'

import ContentLoading from '@/components/contentLoading'
import DatabasePage from '@/components/databasePage'
import SidebarWidthProvider from '@/components/sidebarWidthProvider'
import { appearance, modalDefaults } from '@/constant/appearance'
import { createThemeConfig } from '@/constant/theme'
import { LanguageContext } from '@/contexts/language'
import { DatabaseEngine } from '@/databases/typings'
import { useAppSection } from '@/hooks/useAppSection'
import { useThemePreference } from '@/hooks/useThemePreference'
import { useTranslation } from '@/hooks/useTranslation'
import Workspace from '@/pages/workspace'
import { useWorkspace } from '@/pages/workspace/hooks/useWorkspace'
import type { AppearancePreferences, ThemeMode } from '@/typings/theme'
import { translate } from '@/utils/translate'

const AgentPage = lazy(() => import('@/pages/agent'))
const MonitorPage = lazy(() => import('@/pages/databaseMonitor'))
const SyncPage = lazy(() => import('@/pages/databaseSync'))

function Studio({ themeMode, ...appearance }: AppearancePreferences & { themeMode: ThemeMode }) {
  const { t } = useTranslation()
  const navigation = useAppSection()
  const { section, connectionId, database } = navigation
  const active = section === 'workspace'
  const model = useWorkspace(active)
  const databasePageProps = {
    ...appearance,
    onBack: navigation.openWorkspace,
    connectionError: model.connectionError,
    retryConnections: () => void model.loadConnections()
  }
  const initialConnection = model.savedConnections.find((item) => item.id === connectionId)
  const databasePage = section === 'monitor' || section === 'sync'
  const databasePageTitle = t(section === 'monitor' ? '监控指标' : '同步数据库')
  const loadingPage = (
    <DatabasePage title={databasePageTitle} {...databasePageProps}>
      <ContentLoading label={t('正在加载连接…')} />
    </DatabasePage>
  )
  if (model.desktopClosing) return <ContentLoading label={t('正在保存工作区并关闭全部连接…')} style={{ height: '100dvh' }} />
  return (
    <>
      <div inert={model.desktopPreparing} style={{ display: active ? undefined : 'none' }}>
        <Workspace model={model} active={active} onOpenAgent={navigation.openAgent} onOpenDatabaseSection={navigation.openDatabaseSection} {...appearance} themeMode={themeMode} />
      </div>
      {section === 'agent' && (
        <Suspense fallback={null}>
          <AgentPage onBack={navigation.openWorkspace} themeMode={themeMode} {...appearance} />
        </Suspense>
      )}
      {databasePage && (
        <Suspense fallback={loadingPage}>
          {model.connectionLoading && !model.savedConnections.length ? (
            loadingPage
          ) : section === 'monitor' ? (
            <MonitorPage key={JSON.stringify([connectionId, database])} connections={model.savedConnections} initialConnection={initialConnection} initialDatabase={database} {...databasePageProps} />
          ) : (
            <SyncPage
              key={connectionId}
              connections={model.connections}
              initialConnection={initialConnection?.type === DatabaseEngine.Redis ? undefined : initialConnection}
              onCreated={(id) => void model.objects.refreshDatabases(id).catch(() => {})}
              {...databasePageProps}
            />
          )}
        </Suspense>
      )}
    </>
  )
}

/** 动态弹框使用 AntApp 上下文，确保亮暗主题一致。 */
export default function App() {
  const { preference, fontSizePreference, language, savePreferences, mode, ready } = useThemePreference()
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
              <Studio {...appearancePreferences} themeMode={mode} />
            </SidebarWidthProvider>
          ) : (
            <ContentLoading label={translate('正在读取界面设置…', language)} style={{ height: '100dvh' }} />
          )}
        </AntApp>
      </XProvider>
    </LanguageContext.Provider>
  )
}
