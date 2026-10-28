import { BulbOutlined, DownloadOutlined, HistoryOutlined, LoadingOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import type { ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { Alert, Button, Dropdown, Upload } from 'antd'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import type { ThemeMode } from '@/typings/theme'

import { useAISQL } from '../../hooks/useAISQL'
import { useSQLCompletion } from '../../hooks/useSQLCompletion'
import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { sqlEditorAppearance } from '../../utils/editorAppearance'
import ScopeSelects from '../scopeSelects'
import SQLOptimization from '../sqlOptimization'

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
const editorSetup = { foldGutter: false, autocompletion: true } satisfies ReactCodeMirrorProps['basicSetup']
/** QueryEditor 只负责对应区域展示，状态和业务操作由工作区 hook 提供。 */
export default function QueryEditor({ model, themeMode }: Props) {
  const { activeTab, running, activeRunning, cancelQuery, tab, updateSQL, runSQL, objects, selectObject, connections, selectConnection, onEditorReady, columns } = model
  const { beforeImport, importing } = useSQLImport((sql, title) => model.addTab(sql, { connectionId: tab.connectionId, database: tab.database, schema: tab.schema, table: tab.table }, title))
  const [contextSQL, setContextSQL] = useState('')
  const extensions = useSQLCompletion({ scope: tab, connections, objects, columns })
  const ai = useAISQL(tab, objects, running, connections.find((connection) => connection.id === tab.connectionId)?.type)
  const editorExtensions = useMemo(() => [sqlEditorAppearance, ...extensions, ...ai.extensions], [extensions, ai.extensions])
  const callbacks = useRef({ updateSQL, onUpdate: model.onEditorUpdate })
  useLayoutEffect(() => {
    callbacks.current = { updateSQL, onUpdate: model.onEditorUpdate }
  }, [updateSQL, model.onEditorUpdate])
  // UIW 将回调/配置身份变化视为全量重配，输入时保持身份以保留补全与解析状态。
  const onChange = useCallback((sql: string) => callbacks.current.updateSQL(sql), [])
  const onUpdate = useCallback((update: ViewUpdate) => callbacks.current.onUpdate(update), [])
  return (
    <section className="editor-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)', overflow: 'hidden' }}>
      <div
        className="editor-toolbar"
        style={{
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          padding: 'var(--workspace-inset)',
          borderBottom: '1px solid var(--border)',
          userSelect: 'none'
        }}
      >
        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 500px', minWidth: 0, flexWrap: 'wrap' }}>
          <ScopeSelects
            scope={tab}
            connections={connections}
            objects={objects}
            disabled={running}
            onConnection={selectConnection}
            onSelect={selectObject}
            onSchema={(schema) => selectObject(tab.database, undefined, tab.connectionId, schema)}
          />
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={runSQL} disabled={!objects.connected || running}>
            运行
          </Button>
          {ai.configured && (
            <Button icon={<BulbOutlined />} disabled={!tab.sql.trim() || running} onClick={() => void ai.optimize()}>
              优化
            </Button>
          )}
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
      <SQLOptimization model={ai} themeMode={themeMode} />
      {objects.error && <Alert type="error" title="连接加载失败" description={objects.error} />}
      {objects.tableError && <Alert type="error" title="表列表加载失败" description={objects.tableError} />}
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [
            { key: 'run-selection', label: '运行', icon: <PlayCircleOutlined />, disabled: !contextSQL.trim() || !objects.connected || running },
            ...(ai.configured && contextSQL.trim() ? [{ key: 'optimize-selection', label: '优化', icon: <BulbOutlined />, disabled: running }] : [])
          ],
          onClick: ({ key }) => {
            if (key === 'run-selection') model.runSelectedSQL(contextSQL)
            if (key === 'optimize-selection') void ai.optimize(true, contextSQL)
          }
        }}
      >
        <div
          className="sql-editor"
          onContextMenuCapture={() => setContextSQL(model.getSelectedSQL() ?? '')}
          onScrollCapture={model.rememberEditor}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
        >
          <CodeMirror
            key={activeTab}
            value={tab.sql}
            height="100%"
            style={{ height: '100%' }}
            theme={themeMode}
            extensions={editorExtensions}
            onCreateEditor={(view) => {
              ai.onEditorReady(view)
              onEditorReady(view)
            }}
            onUpdate={onUpdate}
            onChange={onChange}
            basicSetup={editorSetup}
            aria-label="SQL 编辑器"
          />
          {ai.enabled && ai.completionLoading && (
            <LoadingOutlined
              spin
              aria-label="SQL补全中"
              role="status"
              className="sql-completion-loading"
              style={{ position: 'absolute', right: 20, bottom: 12, zIndex: 2, pointerEvents: 'none', color: 'var(--ant-color-text-secondary)' }}
            />
          )}
        </div>
      </Dropdown>
    </section>
  )
}
