import { BulbOutlined, CodeOutlined, DownloadOutlined, FormatPainterOutlined, HistoryOutlined, LoadingOutlined, PlayCircleOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { Alert, Dropdown, Select, Switch, Tooltip, Upload } from 'antd'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { appearance } from '@/constant/appearance'
import type { ThemeMode } from '@/typings/theme'

import { useAISQL } from '../../hooks/useAISQL'
import { useSQLCompletion } from '../../hooks/useSQLCompletion'
import { useSQLCompletionPopup } from '../../hooks/useSQLCompletionPopup'
import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { sqlEditorAppearance } from '../../utils/editorAppearance'
import ScopeSelects from '../scopeSelects'
import SQLCompletionSelect from '../sqlCompletionSelect'
import SQLOptimization from '../sqlOptimization'
import ToolbarButton from '../toolbarButton'

type Props = {
  themeMode: ThemeMode
  model: Pick<
    WorkspaceModel,
    | 'activeTab'
    | 'running'
    | 'activeRunning'
    | 'cancelQuery'
    | 'tab'
    | 'getCurrentSQL'
    | 'getEditorHistory'
    | 'onEditorDispose'
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
  const { activeTab, running, activeRunning, cancelQuery, tab, runSQL, objects, selectObject, connections, selectConnection, onEditorReady, columns } = model
  const { beforeImport, importing } = useSQLImport((sql, title) => model.addTab(sql, { connectionId: tab.connectionId, database: tab.database, schema: tab.schema, table: tab.table }, title))
  const [contextSQL, setContextSQL] = useState('')
  // UIW receives the initial document only; subsequent edits stay in CodeMirror.
  const [initialSQL] = useState(() => tab.sql)
  const [initialHistory] = useState(() => model.getEditorHistory(activeTab))
  const [hasSQL, setHasSQL] = useState(() => Boolean(tab.sql.length))
  const view = useRef<EditorView | null>(null)
  const { extensions, objectKinds } = useSQLCompletion({ scope: tab, connections, objects, columns })
  const completion = useSQLCompletionPopup()
  const { update: updateCompletion } = completion
  const ai = useAISQL(tab, objects, running, connections.find((connection) => connection.id === tab.connectionId)?.type)
  const editorExtensions = useMemo(
    () => [sqlEditorAppearance, ...initialHistory, ...extensions, ...completion.extensions, ...ai.extensions],
    [initialHistory, extensions, completion.extensions, ai.extensions]
  )
  const callbacks = useRef({ onUpdate: model.onEditorUpdate, dispose: model.onEditorDispose })
  useLayoutEffect(() => {
    callbacks.current = { onUpdate: model.onEditorUpdate, dispose: model.onEditorDispose }
  }, [model.onEditorUpdate, model.onEditorDispose])
  useLayoutEffect(
    () => () => {
      if (view.current) callbacks.current.dispose(view.current)
    },
    []
  )
  // UIW 将回调/配置身份变化视为全量重配，输入时保持身份以保留补全与解析状态。
  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      if (update.docChanged) setHasSQL(Boolean(update.state.doc.length))
      updateCompletion(update)
      callbacks.current.onUpdate(update)
    },
    [updateCompletion]
  )
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
          <ToolbarButton label="运行" icon={<PlayCircleOutlined />} onClick={runSQL} disabled={!objects.connected || running} />
          {activeRunning && <ToolbarButton label="取消执行" icon={<StopOutlined />} danger onClick={cancelQuery} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
          {ai.models.length > 0 && (
            <div role="group" aria-label="SQL AI 工具" style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineEnd: 4, paddingInlineEnd: 8, borderInlineEnd: '1px solid var(--border)' }}>
              <Select<string>
                aria-label="SQL AI 模型"
                placeholder="选择 AI 模型"
                value={ai.activeId || undefined}
                allowClear
                disabled={running || ai.preferenceSaving}
                loading={ai.preferenceSaving}
                onChange={(value) => void ai.changeModel(value)}
                style={{ width: appearance.selectWidth }}
                options={ai.models.map((entry) => ({ value: entry.id, label: entry.modelName }))}
              />
              {ai.configured && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CodeOutlined aria-hidden="true" />
                    <span>代码补全</span>
                    <Tooltip title="AI 代码补全">
                      <Switch
                        size="small"
                        aria-label="代码补全"
                        checked={ai.enabled}
                        disabled={running || ai.preferenceSaving}
                        loading={ai.preferenceSaving}
                        onChange={(value) => void ai.changeCompletion(value)}
                      />
                    </Tooltip>
                  </div>
                  <ToolbarButton label="SQL 美化" icon={<FormatPainterOutlined />} disabled={!hasSQL || running} loading={ai.loading} onClick={() => void ai.optimize()} />
                </>
              )}
            </div>
          )}
          <Upload accept=".sql" showUploadList={false} beforeUpload={beforeImport} disabled={running || importing}>
            <ToolbarButton label="导入 SQL" icon={<UploadOutlined />} loading={importing} disabled={running} />
          </Upload>
          <ToolbarButton label="导出 SQL" icon={<DownloadOutlined />} disabled={!hasSQL} onClick={model.exportCurrentSQL} />
          <ToolbarButton label="执行历史" icon={<HistoryOutlined />} disabled={!connections.some((connection) => connection.id === tab.connectionId)} onClick={model.openHistory} />
        </div>
      </div>
      {ai.preferenceError && <Alert type="error" showIcon closable title="AI 设置保存失败" description={ai.preferenceError} onClose={ai.clearPreferenceError} />}
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
          onBlurCapture={() => model.getCurrentSQL()}
          style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}
        >
          <CodeMirror
            key={activeTab}
            value={initialSQL}
            height="100%"
            style={{ height: '100%' }}
            theme={themeMode}
            extensions={editorExtensions}
            onCreateEditor={(created) => {
              view.current = created
              ai.onEditorReady(created)
              onEditorReady(created)
            }}
            onUpdate={onUpdate}
            basicSetup={editorSetup}
            aria-label="SQL 编辑器"
          />
          {ai.enabled && ai.completionLoading && (
            <LoadingOutlined spin aria-label="SQL补全中" role="status" style={{ position: 'absolute', right: 20, bottom: 12, zIndex: 2, pointerEvents: 'none', color: 'var(--text)' }} />
          )}
        </div>
      </Dropdown>
      <SQLCompletionSelect completion={completion} objectKinds={objectKinds} />
    </section>
  )
}
