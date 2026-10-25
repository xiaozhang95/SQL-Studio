import { DownloadOutlined, HistoryOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import CodeMirror from '@uiw/react-codemirror'
import { Alert, Button, Dropdown, Upload } from 'antd'
import { useState } from 'react'

import type { ThemeMode } from '@/typings/theme'

import { useSQLCompletion } from '../../hooks/useSQLCompletion'
import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ScopeSelects from '../scopeSelects'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    | 'activeTab'
    | 'running'
    | 'activeRunning'
    | 'cancelQuery'
    | 'tab'
    | 'updateSQL'
    | 'runSQL'
    | 'getSelectedSQL'
    | 'runSelectedSQL'
    | 'objects'
    | 'selectObject'
    | 'connections'
    | 'selectConnection'
    | 'onEditorReady'
    | 'onEditorUpdate'
    | 'rememberEditor'
    | 'columns'
    | 'addTab'
    | 'exportCurrentSQL'
    | 'openHistory'
  >
}

/** QueryEditor 只负责对应区域展示，状态和业务操作由工作区 hook 提供。 */
export default function QueryEditor({ model, themeMode }: Props) {
  const { activeTab, running, activeRunning, cancelQuery, tab, updateSQL, runSQL, objects, selectObject, connections, selectConnection, onEditorReady, columns } = model
  const { beforeImport, importing } = useSQLImport((sql, title) => model.addTab(sql, undefined, title))
  const [contextSQL, setContextSQL] = useState('')

  const extensions = useSQLCompletion({ scope: tab, connections, objects, columns })
  return (
    <section className="editor-panel">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <ScopeSelects scope={tab} connections={connections} objects={objects} disabled={running} onConnection={selectConnection} onSelect={selectObject} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runSQL} disabled={!objects.connected || running}>
            运行
          </Button>
          {activeRunning && (
            <Button icon={<StopOutlined />} danger onClick={cancelQuery}>
              取消
            </Button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
          <Upload accept=".sql" showUploadList={false} beforeUpload={beforeImport} disabled={running || importing}>
            <Button icon={<UploadOutlined />} loading={importing} disabled={running}>
              导入
            </Button>
          </Upload>
          <Button icon={<DownloadOutlined />} disabled={!tab.sql.trim()} onClick={model.exportCurrentSQL}>
            导出
          </Button>
          <Button icon={<HistoryOutlined />} disabled={!connections.some((connection) => connection.id === tab.connectionId)} onClick={model.openHistory}>
            执行历史
          </Button>
        </div>
      </div>
      {objects.error && <Alert type="error" title="连接加载失败" description={objects.error} />}
      {objects.tableError && <Alert type="error" title="表列表加载失败" description={objects.tableError} />}
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [{ key: 'run-selection', label: '运行选中 SQL', icon: <PlayCircleOutlined />, disabled: !contextSQL.trim() || !objects.connected || running }],
          onClick: ({ key }) => {
            if (key === 'run-selection') model.runSelectedSQL(contextSQL)
          }
        }}
      >
        <div className="sql-editor" onContextMenuCapture={() => setContextSQL(model.getSelectedSQL() ?? '')} onScrollCapture={model.rememberEditor}>
          <CodeMirror
            key={activeTab}
            value={tab.sql}
            height="100%"
            theme={themeMode}
            extensions={extensions}
            onCreateEditor={onEditorReady}
            onUpdate={model.onEditorUpdate}
            onChange={updateSQL}
            basicSetup={{ foldGutter: false, autocompletion: true }}
            aria-label="SQL 编辑器"
          />
        </div>
      </Dropdown>
    </section>
  )
}
