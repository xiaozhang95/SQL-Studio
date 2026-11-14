import { autocompletion } from '@codemirror/autocomplete'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { theme } from 'antd'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { redisCompletion } from '@/databases/redis/editor'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { useQueryShortcut } from '../../../../hooks/useQueryShortcut'
import type { WorkspaceModel } from '../../../../hooks/useWorkspace'
import { sqlEditorAppearance } from '../../../../utils/editorAppearance'
import type { useRedisExecution } from '../../hooks/useRedisExecution'

export type RedisEditorModel = Pick<WorkspaceModel, 'onEditorReady' | 'onEditorUpdate' | 'onEditorDispose' | 'rememberEditor' | 'getCurrentSQL' | 'getEditorHistory' | 'tab'>
type Props = {
  model: RedisEditorModel
  themeMode: ThemeMode
  shortcutEnabled: boolean
  onRun: (view: EditorView) => void
  onViewChange: (view: EditorView | null) => void
  execution: ReturnType<typeof useRedisExecution>
}

const editorSetup = { foldGutter: false, autocompletion: false }
const completion = autocompletion({ override: [redisCompletion] })

export default function Editor({ model, themeMode, shortcutEnabled, onRun, onViewChange, execution }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [initial] = useState(() => ({ value: model.tab.sql, extensions: [sqlEditorAppearance, ...model.getEditorHistory(model.tab.id), completion] }))
  const editor = useRef<EditorView | null>(null)
  const callbacks = useRef({ model, onViewChange })
  useLayoutEffect(() => {
    callbacks.current = { model, onViewChange }
  }, [model, onViewChange])
  useLayoutEffect(
    () => () => {
      if (editor.current) callbacks.current.model.onEditorDispose(editor.current)
      callbacks.current.onViewChange(null)
    },
    []
  )
  useQueryShortcut({
    enabled: shortcutEnabled,
    editor,
    run: () => {
      if (editor.current) onRun(editor.current)
    }
  })
  const onUpdate = useCallback((update: ViewUpdate) => callbacks.current.model.onEditorUpdate(update), [])

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'text' }} onScrollCapture={model.rememberEditor} onBlurCapture={() => model.getCurrentSQL()}>
        <CodeMirror
          value={initial.value}
          extensions={initial.extensions}
          theme={themeMode}
          height="100%"
          style={{ height: '100%' }}
          aria-label={t('Redis 命令编辑器')}
          basicSetup={editorSetup}
          onCreateEditor={(view) => {
            editor.current = view
            callbacks.current.model.onEditorReady(view)
            callbacks.current.onViewChange(view)
          }}
          onUpdate={onUpdate}
        />
      </div>
      {execution.status !== 'idle' && (
        <div style={{ height: 'min(280px, 40%)', minHeight: 90, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', userSelect: 'text' }}>
          <div role="status" style={{ padding: '8px var(--workspace-inset)', borderBottom: '1px solid var(--border)' }}>
            {t(execution.status === 'running' ? '执行中' : execution.status === 'failed' ? '执行失败' : execution.status === 'cancelled' ? '执行已取消' : '执行完成')}
          </div>
          <div role="log" aria-label={t('Redis 执行结果')} style={{ flex: 1, overflow: 'auto', padding: 'var(--workspace-inset)' }}>
            {execution.results.map(({ command, database, output, error, truncated }, index) => (
              <div key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: token.marginSM }}>
                <div style={{ color: token.colorTextSecondary }}>{`redis[${database}]> ${command}`}</div>
                <div style={{ color: error ? token.colorErrorText : token.colorText }}>{error ? t(output) : output || '""'}</div>
                {truncated && <div style={{ color: token.colorTextSecondary }}>{t('仅显示部分内容')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
