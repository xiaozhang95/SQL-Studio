import { CodeOutlined, MoonOutlined, PlusOutlined, SunOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Select, Spin, Typography } from 'antd'

import type { ThemeMode, ThemePreference } from '@/typings/theme'

import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import QueryEditor from './components/queryEditor'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import WorkspaceTabs from './components/workspaceTabs'
import { useWorkspace } from './hooks/useWorkspace'

type Props = { themeMode: ThemeMode; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ themeMode, themePreference, onThemeChange }: Props) {
  const model = useWorkspace()
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-actions">
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text type={model.storageError ? 'danger' : 'secondary'} role="status" aria-label="工作区保存状态">
            {!model.workspaceReady ? '正在恢复…' : model.storageError ? '本地保存不可用' : model.saving ? '正在保存…' : '已加密保存'}
          </Typography.Text>
          <Select
            aria-label="界面主题"
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
      {model.storageError && <Alert type="warning" banner title="本地加密保存不可用，当前页面仍可使用。" description={model.storageError} />}
      {!model.workspaceReady ? (
        <div className="workspace-empty">
          <Spin description="正在恢复工作区…" />
        </div>
      ) : (
        <div className="workspace">
          <ConnectionSidebar model={model} />
          <main className="main-area">
            <div className="query-workspace">
              {model.tabs.length > 0 ? (
                <WorkspaceTabs model={model}>
                  <div className="workspace-page">
                    {model.tab.kind === 'query' && <QueryEditor model={model} themeMode={themeMode} />}
                    <QueryResults model={model} />
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
      <ConnectionModal open={model.connectionModal} connection={model.editing} connections={model.connections} onClose={() => model.setConnectionModal(false)} onSaved={model.onConnectionSaved} />
      <QueryHistory key={model.connectionId} model={model} />
    </div>
  )
}
