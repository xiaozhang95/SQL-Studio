import { LoadingOutlined } from '@ant-design/icons'
import { autocompletion } from '@codemirror/autocomplete'
import { StateField } from '@codemirror/state'
import type { EditorState, Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { redisCommandHints, redisCompletion } from '@/databases/redis/editor'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { useQueryShortcut } from '../../../../hooks/useQueryShortcut'
import type { WorkspaceModel } from '../../../../hooks/useWorkspace'
import { sqlEditorAppearance } from '../../../../utils/editorAppearance'

export type RedisEditorModel = Pick<WorkspaceModel, 'onEditorReady' | 'onEditorUpdate' | 'onEditorDispose' | 'rememberEditor' | 'getCurrentSQL' | 'getEditorHistory' | 'tab'>
type Props = {
  model: RedisEditorModel
  themeMode: ThemeMode
  shortcutEnabled: boolean
  onRun: (view: EditorView) => void
  onViewChange: (view: EditorView | null) => void
  onContentChange: (hasText: boolean) => void
  aiExtensions: Extension[]
  aiCompletionLoading: boolean
}

const editorSetup = { foldGutter: false, autocompletion: false }
const completion = autocompletion({ override: [redisCompletion] })

class CommandHint extends WidgetType {
  readonly text: string
  readonly label: string

  constructor(text: string, label: string) {
    super()
    this.text = text
    this.label = label
  }

  eq(other: CommandHint) {
    return this.text === other.text && this.label === other.label
  }

  toDOM(view: EditorView) {
    const hint = view.dom.ownerDocument.createElement('div')
    hint.className = 'cm-redis-command-hint'
    hint.setAttribute('aria-label', this.label)
    hint.textContent = this.text
    return hint
  }
}

const hintAppearance = EditorView.theme({
  '.cm-redis-command-hint': {
    padding: '0 4px',
    color: 'var(--ant-color-text-secondary)',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere'
  }
})

function commandHints(label: string) {
  function render(state: EditorState) {
    const line = state.doc.lineAt(state.selection.main.head)
    const hint = redisCommandHints(line.text).join(' · ')
    return hint ? Decoration.set([Decoration.widget({ widget: new CommandHint(hint, label), block: true, side: 1 }).range(line.to)]) : Decoration.none
  }

  return StateField.define<DecorationSet>({
    create: render,
    update: (previous, transaction) => (transaction.docChanged || transaction.selection ? render(transaction.state) : previous),
    provide: (field) => EditorView.decorations.from(field)
  })
}

export default function Editor({ model, themeMode, shortcutEnabled, onRun, onViewChange, onContentChange, aiExtensions, aiCompletionLoading }: Props) {
  const { t } = useTranslation()
  const [initial] = useState(() => ({ value: model.tab.sql, extensions: [sqlEditorAppearance, ...model.getEditorHistory(model.tab.id)] }))
  const hintLabel = t('命令用法')
  const hints = useMemo(() => commandHints(hintLabel), [hintLabel])
  const extensions = useMemo(() => [...initial.extensions, hintAppearance, hints, completion, ...aiExtensions], [hints, initial.extensions, aiExtensions])
  const editor = useRef<EditorView | null>(null)
  const callbacks = useRef({ model, onViewChange, onContentChange })
  useLayoutEffect(() => {
    callbacks.current = { model, onViewChange, onContentChange }
  }, [model, onViewChange, onContentChange])
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
  const onUpdate = useCallback((update: ViewUpdate) => {
    callbacks.current.model.onEditorUpdate(update)
    if (update.docChanged) callbacks.current.onContentChange(Boolean(update.state.doc.toString().trim()))
  }, [])

  return (
    <div
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'text', cursor: 'text', position: 'relative' }}
      onScrollCapture={model.rememberEditor}
      onBlurCapture={() => model.getCurrentSQL()}
      onClickCapture={() => {
        const view = editor.current
        if (view && !view.hasFocus) view.focus()
      }}
    >
      <CodeMirror
        value={initial.value}
        extensions={extensions}
        theme={themeMode}
        height="100%"
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
        aria-label={t('Redis 命令编辑器')}
        basicSetup={editorSetup}
        onCreateEditor={(view) => {
          editor.current = view
          callbacks.current.model.onEditorReady(view)
          callbacks.current.onViewChange(view)
        }}
        onUpdate={onUpdate}
      />
      {aiCompletionLoading && (
        <LoadingOutlined spin aria-label={t('AI 代码补全中')} role="status" style={{ position: 'absolute', right: 20, bottom: 12, zIndex: 2, pointerEvents: 'none', color: 'var(--text)' }} />
      )}
    </div>
  )
}
