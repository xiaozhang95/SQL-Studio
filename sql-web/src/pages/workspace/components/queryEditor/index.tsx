import { CloseCircleOutlined, CloseOutlined, CodeOutlined, DownloadOutlined, HistoryOutlined, PlayCircleOutlined, RightOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import { MySQL, sql } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import { Alert, Button, Dropdown, Tabs, Upload } from 'antd'

import type { ThemeMode } from '@/typings/theme'

import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ScopeSelects from '../scopeSelects'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    | 'tabs'
    | 'activeTab'
    | 'running'
    | 'selectTab'
    | 'closeTab'
    | 'closeTabs'
    | 'cancelQuery'
    | 'tab'
    | 'updateSQL'
    | 'runSQL'
    | 'objects'
    | 'selectObject'
    | 'connections'
    | 'selectConnection'
    | 'onEditorReady'
    | 'columns'
    | 'addTab'
    | 'exportCurrentSQL'
    | 'openHistory'
  >
}

/** QueryEditor 只负责对应区域展示，状态和业务操作由工作区 hook 提供。 */
export default function QueryEditor({ model, themeMode }: Props) {
  const { tabs, activeTab, running, selectTab, closeTab, cancelQuery, tab, updateSQL, runSQL, objects, selectObject, connections, selectConnection, onEditorReady, columns } = model
  const { beforeImport, importing } = useSQLImport((sql, title) => model.addTab(sql, undefined, title))

  const selectedTable = tab.table
  return (
    <section className="editor-panel">
      <Tabs
        className="workspace-tabs query-tabs"
        tabBarGutter={4}
        type="editable-card"
        size="small"
        hideAdd
        activeKey={activeTab}
        onChange={selectTab}
        onEdit={(key, action) => {
          if (action === 'remove') closeTab(String(key))
        }}
        renderTabBar={(props, DefaultTabBar) => (
          <DefaultTabBar {...props}>
            {(node) => {
              const key = String(node.key)
              const index = tabs.findIndex((item) => item.id === key)
              return (
                <Dropdown
                  key={key}
                  trigger={['contextMenu']}
                  disabled={running}
                  menu={{
                    items: [
                      { key: 'current', label: '关闭当前', icon: <CloseOutlined /> },
                      { key: 'others', label: '关闭其他', icon: <CloseCircleOutlined />, disabled: tabs.length < 2 },
                      { key: 'right', label: '关闭右侧', icon: <RightOutlined />, disabled: index === tabs.length - 1 }
                    ],
                    onClick: ({ key: action, domEvent }) => {
                      domEvent.stopPropagation()
                      if (action === 'current' || action === 'others' || action === 'right') model.closeTabs(key, action)
                    }
                  }}
                >
                  {node}
                </Dropdown>
              )
            }}
          </DefaultTabBar>
        )}
        items={tabs.map((t) => ({
          key: t.id,
          icon: <CodeOutlined />,
          label: t.title,
          closable: tabs.length > 1 && !running
        }))}
      />
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <ScopeSelects scope={tab} connections={connections} objects={objects} disabled={running} onConnection={selectConnection} onSelect={selectObject} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runSQL} disabled={!objects.connected || running}>
            运行
          </Button>
          {running && (
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
      <div className="sql-editor">
        <CodeMirror
          key={activeTab}
          value={tab.sql}
          height="100%"
          theme={themeMode}
          extensions={[
            sql({
              dialect: MySQL,
              upperCaseKeywords: true,
              schema: selectedTable ? { [selectedTable]: columns.map((c) => c.name) } : {}
            })
          ]}
          onCreateEditor={onEditorReady}
          onChange={updateSQL}
          basicSetup={{ foldGutter: false, autocompletion: true }}
          aria-label="SQL 编辑器"
        />
      </div>
    </section>
  )
}
