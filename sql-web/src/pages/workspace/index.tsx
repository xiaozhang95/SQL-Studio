import { CodeOutlined, MoonOutlined, PlusOutlined, SunOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Select, Upload } from 'antd'

import type { ThemeMode, ThemePreference } from '@/typings/theme'

import ConnectionModal from './components/connectionModal'
import ConnectionSidebar from './components/connectionSidebar'
import QueryEditor from './components/queryEditor'
import QueryHistory from './components/queryHistory'
import QueryResults from './components/queryResults'
import { useSQLImport } from './hooks/useSQLImport'
import { useWorkspace } from './hooks/useWorkspace'

type Props = { themeMode: ThemeMode; themePreference: ThemePreference; onThemeChange: (preference: ThemePreference) => void }
/** 页面入口只组合区域组件，执行和状态逻辑由独立 hook 管理。 */
export default function Workspace({ themeMode, themePreference, onThemeChange }: Props) {
  const model = useWorkspace()
  const { beforeImport, importing } = useSQLImport((sql, title) => model.addTab(sql, undefined, title))
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-actions">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={model.running}
            onClick={() => {
              model.setEditing(undefined)
              model.setConnectionModal(true)
            }}
          >
            新建连接
          </Button>
          <Button icon={<CodeOutlined />} disabled={model.running} onClick={() => model.addTab()}>
            新建查询
          </Button>
          <Upload accept=".sql" showUploadList={false} beforeUpload={beforeImport} disabled={model.running || importing}>
            <Button icon={<UploadOutlined />} loading={importing} disabled={model.running}>
              导入 SQL
            </Button>
          </Upload>
        </div>
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
      </header>
      <div className="workspace">
        <ConnectionSidebar model={model} />
        <main className="main-area">
          <div className="query-workspace">
            <QueryEditor model={model} themeMode={themeMode} />
            <QueryResults model={model} />
          </div>
        </main>
      </div>
      <ConnectionModal open={model.connectionModal} connection={model.editing} onClose={() => model.setConnectionModal(false)} onSaved={model.onConnectionSaved} />
      <QueryHistory model={model} />
    </div>
  )
}
