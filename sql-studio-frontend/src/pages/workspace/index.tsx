import { PlusOutlined, StopOutlined } from '@ant-design/icons'
import { Button, Typography } from 'antd'

import ContentLoading from '@/components/contentLoading'
import PageHeader from '@/components/pageHeader'
import StudioIcon from '@/components/studioIcon'
import { sidebarLayout } from '@/constant/sidebarLayout'
import { DatabaseEngine } from '@/databases/typings'
import type { DatabaseSection, DatabaseSectionScope } from '@/hooks/useAppSection'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import ConnectionGroupModal from './components/connectionGroupModal'
import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import DataExport from './components/dataExport'
import ObjectManagementModal from './components/objectManagementModal'
import QueryEditor from './components/queryEditor'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import RedisQuery from './components/redisQuery'
import TableDesigner from './components/tableDesigner'
import WorkspaceTabs from './components/workspaceTabs'
import { workspaceEmptyStyle } from './constant/layout'
import type { WorkspaceModel } from './hooks/useWorkspace'

type Props = {
  model: WorkspaceModel
  active: boolean
  onOpenDatabaseSection: (section: DatabaseSection, scope?: DatabaseSectionScope) => void
  themeMode: ThemeMode
}
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ model, active, onOpenDatabaseSection, themeMode }: Props) {
  const { t } = useTranslation()

  const sidebar = useSidebarResize(model.sidebarWidth, model.setSidebarWidth, sidebarLayout, model.workspaceReady)
  const connection = model.savedConnections.find((item) => item.id === model.tab.connectionId)
  const breadcrumb = [connection?.name, model.tab.database, model.tab.title].filter(Boolean).join(' / ')
  return (
    <div className="app-shell" style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', color: 'var(--text)', background: 'var(--surface)' }}>
      <PageHeader
        title={t('工作台')}
        breadcrumb={breadcrumb || undefined}
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
        actions={
          <>
            {model.tabs.length > 0 && (
              <Button icon={<PlusOutlined />} disabled={model.running || !model.workspaceReady} onClick={model.newQuery}>
                {t('新建查询')}
              </Button>
            )}
            {model.runningTabId && !model.activeRunning && (
              <Button type="text" danger icon={<StopOutlined />} onClick={model.cancelQuery}>
                {t('取消执行')}
              </Button>
            )}
          </>
        }
      />
      {!model.workspaceReady ? (
        <div className="workspace-empty" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
          <ContentLoading label={t('正在恢复工作区…')} />
        </div>
      ) : (
        <div className="workspace" style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ConnectionSidebar
            model={model}
            layout={sidebar}
            onOpenDatabaseSection={onOpenDatabaseSection}
            onNewConnection={() => {
              model.setEditing(undefined)
              model.setConnectionModal(true)
            }}
          />
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
                    {model.pageReady && (
                      <>
                        {model.tab.kind === 'query' && <QueryEditor key={model.activeTab} model={model} themeMode={themeMode} />}
                        <QueryResults model={model} themeMode={themeMode} />
                      </>
                    )}
                  </>
                </WorkspaceTabs>
              ) : (
                <div style={workspaceEmptyStyle}>
                  <Typography.Title level={3} style={{ margin: 0 }}>
                    {t('开始一次查询')}
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ maxWidth: 460 }}>
                    {t('新建查询开始编写 SQL，或双击左侧表查看数据')}
                  </Typography.Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Button type="primary" icon={<PlusOutlined />} disabled={model.running || !model.workspaceReady} onClick={model.newQuery}>
                      {t('新建查询')}
                    </Button>
                    <Button
                      icon={<StudioIcon name="database" size={16} />}
                      disabled={model.running || !model.workspaceReady}
                      onClick={() => {
                        model.setEditing(undefined)
                        model.setConnectionModal(true)
                      }}
                    >
                      {t('新建连接')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>
          {model.tabs.length > 0 && !model.pageReady && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
              {model.pageLoadFailed ? <Button onClick={model.retryPage}>{t('重试')}</Button> : <ContentLoading label={t('正在加载当前标签…')} />}
            </div>
          )}
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
        <QueryHistory key={model.connectionId} model={model} themeMode={themeMode} />
      )}
    </div>
  )
}
