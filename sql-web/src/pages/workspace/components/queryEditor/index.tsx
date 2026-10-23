import { CodeOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons'
import { MySQL, PostgreSQL, sql } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import { Alert, Button, Tabs } from 'antd'

import type { ThemeMode } from '@/typings/theme'

import type { WorkspaceModel } from '../../hooks/useWorkspace'
import ScopeSelects from '../scopeSelects'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    'tabs' | 'activeTab' | 'running' | 'selectTab' | 'closeTab' | 'cancelQuery' | 'tab' | 'updateSQL' | 'runSQL' | 'objects' | 'selectObject' | 'connection' | 'onEditorReady' | 'postgres' | 'columns'
  >
}

/** QueryEditor 只负责对应区域展示，状态和业务操作由工作区 hook 提供。 */
export default function QueryEditor({ model, themeMode }: Props) {
  const { tabs, activeTab, running, selectTab, closeTab, cancelQuery, tab, updateSQL, runSQL, objects, selectObject, connection, onEditorReady, postgres, columns } = model

  const selectedTable = tab.table
  return (
    <section className="editor-panel">
      <Tabs
        className="query-tabs"
        tabBarGutter={4}
        type="editable-card"
        hideAdd
        activeKey={activeTab}
        onChange={selectTab}
        onEdit={(key, action) => {
          if (action === 'remove') closeTab(String(key))
        }}
        items={tabs.map((t) => ({
          key: t.id,
          label: (
            <span>
              <CodeOutlined /> {t.title}
            </span>
          ),
          closable: tabs.length > 1 && !running
        }))}
      />
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <ScopeSelects scope={tab} objects={objects} disabled={!connection || running} onSelect={selectObject} />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runSQL} disabled={!connection || running}>
            运行 SQL
          </Button>
          {running && (
            <Button icon={<StopOutlined />} danger onClick={cancelQuery}>
              取消
            </Button>
          )}
        </div>
      </div>
      {objects.tableError && <Alert type="error" title="表列表加载失败" description={objects.tableError} />}
      <div className="sql-editor">
        <CodeMirror
          key={activeTab}
          value={tab.sql}
          height="100%"
          theme={themeMode}
          extensions={[
            sql({
              dialect: postgres ? PostgreSQL : MySQL,
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
