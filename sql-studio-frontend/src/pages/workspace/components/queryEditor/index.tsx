import { BulbOutlined, DownloadOutlined, HistoryOutlined, LoadingOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined, UploadOutlined } from '@ant-design/icons'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { Button, Dropdown, Switch, Tooltip, Upload } from 'antd'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import StudioIcon from '@/components/studioIcon'
import { usePageError } from '@/contexts/pageErrors'
import { DatabaseEngine } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { useAISQL } from '../../hooks/useAISQL'
import { useSQLCompletion } from '../../hooks/useSQLCompletion'
import { useSQLCompletionPopup } from '../../hooks/useSQLCompletionPopup'
import { useSQLImport } from '../../hooks/useSQLImport'
import type { WorkspaceModel } from '../../hooks/useWorkspace'
import { sqlEditorAppearance } from '../../utils/editorAppearance'
import QueryToolbar from '../queryToolbar'
import RunButton from '../runButton'
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
    | 'connectionAction'
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
    | 'savedConnections'
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
  const { t } = useTranslation()

  const { activeTab, running, activeRunning, cancelQuery, tab, runSQL, objects, connections, onEditorReady, columns } = model
  const {
    beforeImport,
    importing,
    error: importError
  } = useSQLImport((sql, title) => model.addTab(sql, { connectionId: tab.connectionId, database: tab.database, schema: tab.schema, table: tab.table }, title))
  usePageError(importError)
  usePageError(objects.tableError, `${tab.connectionId}:${tab.database}`)
  const [contextSQL, setContextSQL] = useState('')
  const engine = connections.find((connection) => connection.id === tab.connectionId)?.type
  const mysqlCompatible = engine === DatabaseEngine.MySQL || engine === DatabaseEngine.MariaDB
  // UIW receives the initial document only; subsequent edits stay in CodeMirror.
  const [initialSQL] = useState(() => tab.sql)
  const [initialHistory] = useState(() => model.getEditorHistory(activeTab))
  const [hasSQL, setHasSQL] = useState(() => Boolean(tab.sql.length))
  const view = useRef<EditorView | null>(null)
  const { extensions, objectKinds } = useSQLCompletion({ scope: tab, connections, objects, columns })
  const completion = useSQLCompletionPopup()
  const { update: updateCompletion } = completion
  const ai = useAISQL(tab, objects, running, connections.find((connection) => connection.id === tab.connectionId)?.type)
  const aiModelHint = ai.configured ? undefined : t('请先在系统设置中保存默认模型')
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
      <QueryToolbar
        model={model}
        disabled={running}
        runActions={
          <>
            <RunButton themeMode={themeMode} onClick={runSQL} disabled={!objects.connected || running} />
            {activeRunning && (
              <Button type="text" danger icon={<StopOutlined />} onClick={cancelQuery}>
                {t('取消执行')}
              </Button>
            )}
            {objects.error && (
              <ToolbarButton label={t('重试连接')} hint={objects.error} icon={<ReloadOutlined />} disabled={running} onClick={() => model.connectionAction('open', tab.connectionId)} />
            )}
          </>
        }
      >
        {ai.hasSavedModel && (
          <div
            role="group"
            aria-label={t('SQL AI 工具')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 26,
              marginInlineEnd: 4,
              paddingInlineEnd: 8,
              borderInlineEnd: '1px solid var(--border)'
            }}
          >
            <Tooltip title={aiModelHint ?? t('AI 代码补全')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StudioIcon name="sparkle" size={14} />
                <span>{t('AI 补全')}</span>
                <Switch
                  size="small"
                  aria-label={t('AI 代码补全')}
                  checked={ai.configured && ai.enabled}
                  disabled={!ai.configured || running || ai.preferenceSaving}
                  loading={ai.preferenceSaving}
                  onChange={(value) => void ai.changeCompletion(value)}
                />
              </div>
            </Tooltip>
            <ToolbarButton
              label={t('优化')}
              hint={aiModelHint}
              icon={<StudioIcon name="zap" size={14} />}
              disabled={!ai.configured || !hasSQL || running}
              loading={ai.loading}
              onClick={() => void ai.optimize()}
            />
          </div>
        )}
        <Upload accept=".sql" showUploadList={false} beforeUpload={beforeImport} disabled={running || importing}>
          <ToolbarButton label={t('导入')} icon={<UploadOutlined />} loading={importing} disabled={running} />
        </Upload>
        <ToolbarButton label={t('导出')} icon={<DownloadOutlined />} disabled={!hasSQL} onClick={model.exportCurrentSQL} />
        <ToolbarButton label={t('执行历史')} icon={<HistoryOutlined />} disabled={!connections.some((connection) => connection.id === tab.connectionId)} onClick={model.openHistory} />
      </QueryToolbar>
      <SQLOptimization model={ai} themeMode={themeMode} />
      <Dropdown
        trigger={['contextMenu']}
        menu={{
          items: [
            { key: 'run-selection', label: t('运行'), icon: <PlayCircleOutlined />, disabled: !contextSQL.trim() || !objects.connected || running },
            ...(mysqlCompatible && contextSQL.trim()
              ? [
                  { key: 'run-single-statement', label: t('作为单条 SQL 运行'), disabled: !objects.connected || running },
                  { key: 'run-insert-transaction', label: t('在事务中运行 INSERT'), disabled: !objects.connected || running }
                ]
              : []),
            ...(ai.configured && contextSQL.trim() ? [{ key: 'optimize-selection', label: t('优化'), icon: <BulbOutlined />, disabled: running }] : [])
          ],
          onClick: ({ key }) => {
            if (key === 'run-selection') model.runSelectedSQL(contextSQL)
            if (key === 'run-single-statement') model.runSelectedSQL(contextSQL, 'single')
            if (key === 'run-insert-transaction') model.runSelectedSQL(contextSQL, 'insertTransaction')
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
            aria-label={t('SQL 编辑器')}
          />
          {ai.enabled && ai.completionLoading && (
            <LoadingOutlined spin aria-label={t('SQL补全中')} role="status" style={{ position: 'absolute', right: 20, bottom: 12, zIndex: 2, pointerEvents: 'none', color: 'var(--text)' }} />
          )}
        </div>
      </Dropdown>
      <SQLCompletionSelect completion={completion} objectKinds={objectKinds} />
    </section>
  )
}
