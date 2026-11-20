import { CodeOutlined, PlusOutlined, StarOutlined, StopOutlined } from '@ant-design/icons'
import { Button, Empty } from 'antd'

import ContentLoading from '@/components/contentLoading'
import PageHeader from '@/components/pageHeader'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import { sidebarLayout } from '@/constant/sidebarLayout'
import { DatabaseEngine } from '@/databases/typings'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences, ThemeMode } from '@/typings/theme'

import ConnectionGroupModal from './components/connectionGroupModal'
import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import DataExport from './components/dataExport'
import ObjectManagementModal from './components/objectManagementModal'
import QueryEditor from './components/queryEditor'
import QueryFavorites from './components/queryFavorites'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import RedisQuery from './components/redisQuery'
import TableDesigner from './components/tableDesigner'
import WorkspaceTabs from './components/workspaceTabs'
import { useQueryFavorites } from './hooks/useQueryFavorites'
import type { WorkspaceModel } from './hooks/useWorkspace'
import { selectedConnectionScope } from './utils/explorerTree'
import { workspacePageTitle } from './utils/pageTitle'

type Props = AppearancePreferences & {
  model: WorkspaceModel
  active: boolean
  onOpenAgent: () => void
  onOpenDatabaseSection: (section: DatabaseSection, scope?: DatabaseSectionScope) => void
  themeMode: ThemeMode
}
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ model, active, onOpenAgent, onOpenDatabaseSection, themeMode, themeReady, ...appearancePreferences }: Props) {
  const { t } = useTranslation()

  const sidebar = useSidebarResize(model.sidebarWidth, model.setSidebarWidth, sidebarLayout, model.workspaceReady)
  const favorites = useQueryFavorites()
  return (
    <div
      className="app-shell"
      style={{ height: '100dvh', minWidth: 900, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', color: 'var(--text)', background: 'var(--surface)' }}
    >
      <PageHeader
        desktopTitle={model.tab.id ? workspacePageTitle(model.tab) : 'SQL Studio'}
        desktopActive={active}
        errors={[
          model.connectionError,
          model.operationError,
          model.connectionGroups.moveError,
          model.objectManagement.dialog ? undefined : model.objectManagement.refreshError,
          model.pageLoadFailed ? t('标签内容暂不可用') : undefined
        ]}
        onErrorClose={() => {
          model.clearOperationError()
          model.connectionGroups.clearMoveError()
          model.objectManagement.clearRefreshError()
        }}
        errorAction={
          model.connectionError ? (
            <Button loading={model.connectionLoading} onClick={() => void model.loadConnections()}>
              {t('重试')}
            </Button>
          ) : undefined
        }
        errorScope={model.activeTab}
        actions={<SystemSettings themeReady={themeReady} {...appearancePreferences} />}
      >
        <div className="topbar-primary-actions" style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <Button
            type="text"
            icon={<PlusOutlined />}
            disabled={model.running || !model.workspaceReady}
            onClick={() => {
              model.setEditing(undefined)
              model.setConnectionModal(true)
            }}
          >
            {t('新建连接')}
          </Button>
          <Button type="text" icon={<CodeOutlined />} disabled={model.running || !model.workspaceReady} onClick={model.newQuery}>
            {t('新建查询')}
          </Button>
          <Button type="text" icon={<StarOutlined />} onClick={favorites.show}>
            {t('查询收藏')}
          </Button>
        </div>
        <SectionNavigation destination="sync" onSwitch={() => onOpenDatabaseSection('sync')} />
        <SectionNavigation
          destination="monitor"
          onSwitch={() => onOpenDatabaseSection('monitor', selectedConnectionScope(model.explorer.selected[0], model.savedConnections) ?? model.tab)}
          separated={false}
        />
        <SectionNavigation destination="agent" onSwitch={onOpenAgent} separated={false} />
        {model.runningTabId && !model.activeRunning && (
          <Button type="text" danger icon={<StopOutlined />} onClick={model.cancelQuery}>
            {t('取消执行')}
          </Button>
        )}
      </PageHeader>
      {!model.workspaceReady ? (
        <div className="workspace-empty" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
          <ContentLoading label={t('正在恢复工作区…')} />
        </div>
      ) : (
        <div className="workspace" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ConnectionSidebar model={model} layout={sidebar} onOpenDatabaseSection={onOpenDatabaseSection} />
          <main className="main-area" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <div className="query-workspace" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {model.tabs.length > 0 ? (
                <WorkspaceTabs
                  model={model}
                  renderRedis={(page, connection) => (
                    <RedisQuery key={connection.id} model={{ ...model, tab: page }} connection={connection} active={active && page.id === model.activeTab && model.pageReady} themeMode={themeMode} />
                  )}
                  renderDesigner={(page) => (
                    <TableDesigner
                      key={page.id}
                      page={page}
                      active={page.id === model.activeTab}
                      connections={model.connections}
                      themeMode={themeMode}
                      available={model.objects.snapshots[page.connectionId]?.status === 'connected'}
                      blocked={model.isTableDesignerBlocked(page)}
                      onBusyChange={model.setTableDesignerBusy}
                      onDirtyChange={model.setTableDesignerDirty}
                      onCommitted={model.tableDesignerCommitted}
                      onChanged={model.onObjectChanged}
                    />
                  )}
                >
                  <>
                    {!model.pageReady ? (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                        {model.pageLoadFailed ? <Button onClick={model.retryPage}>{t('重试')}</Button> : <ContentLoading label={t('正在加载当前标签…')} />}
                      </div>
                    ) : (
                      <>
                        {model.tab.kind === 'query' && (
                          <QueryEditor
                            key={model.activeTab}
                            model={model}
                            themeMode={themeMode}
                            onFavorite={(sql) => favorites.edit({ sql, connectionId: model.tab.connectionId, database: model.tab.database, schema: model.tab.schema })}
                          />
                        )}
                        <QueryResults model={model} themeMode={themeMode} />
                      </>
                    )}
                  </>
                </WorkspaceTabs>
              ) : (
                <div className="workspace-empty" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('点击顶部“新建查询”开始编写 SQL，双击左侧表查看数据；数据库结构列表可从右键菜单打开。')} />
                </div>
              )}
            </div>
          </main>
        </div>
      )}
      <DataExport model={model.dataExport} />
      <ObjectManagementModal manager={model.objectManagement} themeMode={themeMode} />
      <ConnectionGroupModal manager={model.connectionGroups} />
      <ConnectionModal
        open={model.connectionModal}
        connection={model.editing}
        groups={model.connectionGroups.groups}
        onClose={() => model.setConnectionModal(false)}
        onSaved={model.onConnectionSaved}
      />
      {!model.savedConnections.some((connection) => connection.id === model.connectionId && connection.type === DatabaseEngine.Redis) && (
        <QueryHistory key={model.connectionId} model={model} themeMode={themeMode} onFavorite={({ sql, connectionId, database, schema }) => favorites.edit({ sql, connectionId, database, schema })} />
      )}
      <QueryFavorites
        favorites={favorites}
        connections={model.connections}
        themeMode={themeMode}
        canOpen={model.workspaceReady && !model.running}
        onOpen={(item) => {
          const connection = model.connections.find(({ id }) => id === item.connectionId)
          const scope = connection ? { connectionId: connection.id, database: item.database, schema: item.schema, table: '' } : undefined
          if (model.addTab(item.sql, scope, item.title)) favorites.setOpen(false)
        }}
      />
    </div>
  )
}
