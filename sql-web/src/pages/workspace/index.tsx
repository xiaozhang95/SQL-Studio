import { CodeOutlined, MoonOutlined, PlusOutlined, SunOutlined } from '@ant-design/icons'
import { Alert, Button, Divider, Empty, Select, Spin } from 'antd'
import type { CSSProperties } from 'react'

import type { ThemeMode, ThemePreference } from '@/typings/theme'

import AISettings from './components/aiSettings'
import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import ObjectManagementModal from './components/objectManagementModal'
import QueryEditor from './components/queryEditor'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import SaveStatus from './components/saveStatus'
import TableDesigner from './components/tableDesigner'
import WorkspaceTabs from './components/workspaceTabs'
import { useSidebarResize } from './hooks/useSidebarResize'
import { useWorkspace } from './hooks/useWorkspace'

type Props = { themeReady: boolean; themeSaving: boolean; themeError?: string; themeMode: ThemeMode; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ themeMode, themePreference, onThemeChange, themeError, themeReady, themeSaving }: Props) {
  const model = useWorkspace()
  const sidebar = useSidebarResize(model.sidebarWidth, model.setSidebarWidth, model.workspaceReady)
  const storageError = model.storageError || themeError
  return (
    <div className="app-shell" style={{ '--sidebar-width': `${sidebar.visibleWidth}px` } as CSSProperties}>
      <header className="topbar">
        <div className="topbar-actions">
          <div className="topbar-primary-actions">
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
            <Button icon={<CodeOutlined />} disabled={model.running || !model.workspaceReady} onClick={() => model.addTab()}>
              新建查询
            </Button>
            <Divider type="vertical" style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', margin: 0 }} />
          </div>
          <AISettings themeMode={themeMode} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <SaveStatus restoring={!model.workspaceReady || (!themeReady && !themeError)} saving={model.saving || themeSaving} error={storageError} />
          <Select
            aria-label="界面主题"
            placeholder="选择界面主题"
            disabled={!themeReady}
            className="theme-select"
            value={themePreference}
            onChange={onThemeChange}
            prefix={themeMode === 'dark' ? <MoonOutlined /> : <SunOutlined />}
            options={[
              { value: 'system', label: '跟随系统' },
              { value: 'light', label: '亮色模式' },
              { value: 'dark', label: '暗黑模式' }
            ]}
          />
        </div>
      </header>
      {storageError && <Alert key={storageError} closable type="warning" banner title="本机配置保存不可用，当前页面仍可使用。" description={storageError} />}
      {!model.workspaceReady ? (
        <div className="workspace-empty">
          <Spin description="正在恢复工作区…" />
        </div>
      ) : (
        <div className="workspace">
          <ConnectionSidebar model={model} layout={sidebar} />
          <main className="main-area">
            <div className="query-workspace">
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
                  <div className="workspace-page">
                    {model.tab.kind === 'query' && (
                      <QueryEditor key={JSON.stringify([model.activeTab, model.tab.connectionId, model.tab.database, model.running])} model={model} themeMode={themeMode} />
                    )}
                    <QueryResults model={model} themeMode={themeMode} />
                  </div>
                </WorkspaceTabs>
              ) : (
                <div className="workspace-empty">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="点击顶部“新建查询”开始编写 SQL，也可以双击左侧数据库或表查看结构与数据。" />
                </div>
              )}
            </div>
          </main>
        </div>
      )}
      <ObjectManagementModal manager={model.objectManagement} themeMode={themeMode} />
      <ConnectionModal open={model.connectionModal} connection={model.editing} connections={model.connections} onClose={() => model.setConnectionModal(false)} onSaved={model.onConnectionSaved} />
      <QueryHistory key={model.connectionId} model={model} themeMode={themeMode} />
    </div>
  )
}
