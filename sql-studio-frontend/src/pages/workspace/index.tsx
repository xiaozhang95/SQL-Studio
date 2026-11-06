import { CodeOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { Alert, Button, Empty } from 'antd'

import ContentLoading from '@/components/contentLoading'
import PageHeader from '@/components/pageHeader'
import SaveStatus from '@/components/saveStatus'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import { sidebarLayout } from '@/constant/sidebarLayout'
import { useSidebarResize } from '@/hooks/useSidebarResize'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

import ConnectionGroupModal from './components/connectionGroupModal'
import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import DataExport from './components/dataExport'
import ObjectManagementModal from './components/objectManagementModal'
import QueryEditor from './components/queryEditor'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import TableDesigner from './components/tableDesigner'
import WorkspaceTabs from './components/workspaceTabs'
import { useWorkspace } from './hooks/useWorkspace'
import { workspacePageTitle } from './utils/pageTitle'

type Props = {
  active: boolean
  onOpenAgent: () => void
  themeReady: boolean
  themeSaving: boolean
  themeError?: string
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (preference: ThemePreference) => void
}
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ active, onOpenAgent, themeMode, themePreference, onThemeChange, themeError, themeReady, themeSaving }: Props) {
  const model = useWorkspace(active)
  const sidebar = useSidebarResize(model.sidebarWidth, model.setSidebarWidth, sidebarLayout, model.workspaceReady)
  const storageError = model.storageError || themeError
  const noticeError = [...new Set([storageError, model.connectionError].filter(Boolean))].join('\n')
  return (
    <div
      className="app-shell"
      style={{ height: '100dvh', minWidth: 900, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', color: 'var(--text)', background: 'var(--surface)' }}
    >
      <PageHeader
        desktopTitle={model.tab.id ? workspacePageTitle(model.tab) : 'SQL Studio'}
        desktopActive={active}
        actions={
          <>
            {' '}
            <SaveStatus restoring={!model.workspaceReady || (!themeReady && !themeError)} saving={model.saving || themeSaving} error={storageError} />
            <SystemSettings themeMode={themeMode} themePreference={themePreference} onThemeChange={onThemeChange} themeReady={themeReady} />
          </>
        }
      >
        {' '}
        <div className="topbar-primary-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={model.running || !model.workspaceReady}
            onClick={() => {
              model.setEditing(undefined)
              model.setConnectionModal(true)
            }}
          >
            新建连接
          </Button>
          <Button icon={<CodeOutlined />} disabled={model.running || !model.workspaceReady} onClick={model.newQuery}>
            新建查询
          </Button>
        </div>
        {model.runningTabId && !model.activeRunning && (
          <Button danger icon={<StopOutlined />} onClick={model.cancelQuery}>
            取消执行
          </Button>
        )}
        <SectionNavigation destination="agent" onSwitch={onOpenAgent} />
      </PageHeader>
      {noticeError && (
        <Alert
          key={noticeError}
          closable
          type="warning"
          banner
          title={storageError ? '本机配置保存不可用，当前页面仍可使用。' : '连接列表加载失败，当前页面仍可使用。'}
          description={<div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{noticeError}</div>}
          action={
            !storageError && model.connectionError ? (
              <Button loading={model.connectionLoading} onClick={() => void model.loadConnections()}>
                重试
              </Button>
            ) : undefined
          }
        />
      )}
      {!model.workspaceReady ? (
        <div className="workspace-empty" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
          <ContentLoading label="正在恢复工作区…" />
        </div>
      ) : (
        <div className="workspace" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ConnectionSidebar model={model} layout={sidebar} />
          <main className="main-area" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
            <div className="query-workspace" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {model.tabs.length > 0 ? (
                <WorkspaceTabs
                  model={model}
                  renderDesigner={(page) => (
                    <TableDesigner
                      key={page.id}
                      page={page}
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
                  <div className="workspace-page" style={{ height: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    {!model.pageReady ? (
                      model.pageLoadError ? (
                        <Alert type="error" title="标签内容加载失败" description={model.pageLoadError} action={<Button onClick={model.retryPage}>重试</Button>} />
                      ) : (
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                          <ContentLoading label="正在加载当前标签…" />
                        </div>
                      )
                    ) : (
                      <>
                        {model.tab.kind === 'query' && <QueryEditor key={model.activeTab} model={model} themeMode={themeMode} />}
                        <QueryResults model={model} themeMode={themeMode} />
                      </>
                    )}
                  </div>
                </WorkspaceTabs>
              ) : (
                <div className="workspace-empty" style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, background: 'var(--surface)' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击顶部“新建查询”开始编写 SQL，也可以双击左侧数据库或表查看结构与数据。" />
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
      <QueryHistory key={model.connectionId} model={model} themeMode={themeMode} />
    </div>
  )
}
