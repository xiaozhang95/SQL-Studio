import { XProvider } from '@ant-design/x'
import xEnUS from '@ant-design/x/locale/en_US'
import xZhCN from '@ant-design/x/locale/zh_CN'
import { App as AntApp } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { lazy, Suspense, useEffect, useMemo, useRef } from 'react'

import AppRail from '@/components/appRail'
import ContentLoading from '@/components/contentLoading'
import DatabasePage from '@/components/databasePage'
import DesktopTitleBar from '@/components/desktopTitleBar'
import { PageErrorsProvider } from '@/components/pageErrors'
import SidebarWidthProvider from '@/components/sidebarWidthProvider'
import { appearance, modalDefaults } from '@/constant/appearance'
import { createThemeConfig } from '@/constant/theme'
import { LanguageContext } from '@/contexts/language'
import { NavigationLockProvider } from '@/contexts/navigationLock'
import { DatabaseEngine } from '@/databases/typings'
import { useAppSection } from '@/hooks/useAppSection'
import { useThemePreference } from '@/hooks/useThemePreference'
import { useTranslation } from '@/hooks/useTranslation'
import Workspace from '@/pages/workspace'
import { useWorkspace } from '@/pages/workspace/hooks/useWorkspace'
import { selectedConnectionScope } from '@/pages/workspace/utils/explorerTree'
import { workspacePageTitle } from '@/pages/workspace/utils/pageTitle'
import { subscribeOpenQuery } from '@/services/openQuery'
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
  const openQuery = useRef<(sql: string) => void>(() => {})
  useEffect(() => {
    openQuery.current = (sql) => {
      const { connectionId, database, schema } = model.tab
      model.addTab(sql, { connectionId, database, schema, table: '' })
      navigation.openWorkspace()
    }
  })
  useEffect(() => subscribeOpenQuery((sql) => openQuery.current(sql)), [])
  const databasePageProps = {
    onBack: navigation.openWorkspace,
    connectionError: model.connectionError,
    retryConnections: () => void model.loadConnections()
  }
  const initialConnection = model.savedConnections.find((item) => item.id === connectionId)
  const databasePage = section === 'monitor' || section === 'sync'
  const databasePageTitle = t(section === 'monitor' ? '监控指标' : '同步数据库')
  const monitorScope =
    selectedConnectionScope(model.explorer.selected[0], model.savedConnections) ??
    (model.tab.connectionId ? { connectionId: model.tab.connectionId, database: model.tab.database } : undefined)
  const desktopTitle = section === 'workspace' ? (model.tab.id ? workspacePageTitle(model.tab) : 'SQL Studio') : section === 'agent' ? t('AI 助手') : databasePageTitle
  const loadingPage = (
    <DatabasePage title={databasePageTitle} {...databasePageProps}>
      <ContentLoading label={t('正在加载连接…')} />
    </DatabasePage>
  )
  if (model.desktopClosing) return <ContentLoading label={t('正在保存工作区并关闭全部连接…')} style={{ height: '100dvh' }} />
  return (
    <div className="studio-shell" style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)', color: 'var(--text)' }}>
      <DesktopTitleBar showTitle title={desktopTitle} />
      <div className="studio-body" style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <AppRail
          section={section}
          themeMode={themeMode}
          disabled={model.desktopPreparing}
          onOpenWorkspace={navigation.openWorkspace}
          onOpenAgent={navigation.openAgent}
          onOpenDatabaseSection={(name, scope) => navigation.openDatabaseSection(name, name === 'monitor' ? (scope ?? monitorScope) : scope)}
          {...appearance}
        />
        <div className="studio-content" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div inert={model.desktopPreparing} style={{ display: active ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
            <PageErrorsProvider>
              <Workspace model={model} active={active} onOpenDatabaseSection={navigation.openDatabaseSection} themeMode={themeMode} />
            </PageErrorsProvider>
          </div>
          {section === 'agent' && (
            <Suspense fallback={null}>
              <AgentPage themeMode={themeMode} />
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
                  onOpenTarget={(targetConnectionId, database) => {
                    model.addTab('', { connectionId: targetConnectionId, database, schema: '', table: '' })
                    navigation.openWorkspace()
                  }}
                  {...databasePageProps}
                />
              )}
            </Suspense>
          )}
        </div>
      </div>
    </div>
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
      <XProvider locale={locale} componentSize={appearance.controlSize} modal={modalDefaults} theme={themeConfig}>
        <AntApp message={{ styles: { root: { display: 'none' } } }}>
          {ready ? (
            <NavigationLockProvider>
              <SidebarWidthProvider>
                <Studio {...appearancePreferences} themeMode={mode} />
              </SidebarWidthProvider>
            </NavigationLockProvider>
          ) : (
            <ContentLoading label={translate('正在读取界面设置…', language)} style={{ height: '100dvh' }} />
          )}
        </AntApp>
      </XProvider>
    </LanguageContext.Provider>
  )
}
