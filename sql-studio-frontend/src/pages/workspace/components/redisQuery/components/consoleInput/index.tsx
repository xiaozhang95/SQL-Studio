import { acceptCompletion, autocompletion, closeCompletion, completionStatus } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import CodeMirror, { ExternalChange } from '@uiw/react-codemirror'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { redisCompletion } from '@/databases/redis/editor'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { useSQLCompletionPopup } from '../../../../hooks/useSQLCompletionPopup'
import SQLCompletionSelect from '../../../sqlCompletionSelect'
import { terminalCommandLimit } from '../../utils/terminalSession'
import type { TerminalSelection } from '../../utils/terminalSession'

type Props = {
  value: string
  initialSelection: TerminalSelection
  themeMode: ThemeMode
  disabled: boolean
  onChange: (value: string) => void
  onSelectionChange: (selection: TerminalSelection) => void
  onExecute: () => void
  onRecall: (direction: -1 | 1) => void
  onClear: () => void
  onViewChange: (view: EditorView | null) => void
}

const objectKinds = new Map<never, never>()
const localCompletion = autocompletion({ override: [redisCompletion] })
const singleLine = (value: string) => value.replace(/[\r\n]/g, '').slice(0, terminalCommandLimit)
const appearance = EditorView.theme({
  '&.cm-editor': { background: 'transparent', color: 'var(--text)', font: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { font: 'inherit', lineHeight: 'inherit' },
  '.cm-content': { padding: 0, minHeight: '1lh' },
  '.cm-line': { padding: 0 }
})

/** 单行输入复用编辑器的命令来源和候选展示，执行仍由终端拥有。 */
export default function ConsoleInput(props: Props) {
  const { t } = useTranslation()
  const { value, themeMode, disabled } = props
  const [initial] = useState(() => {
    const text = singleLine(value)
    return { value: text, selection: { anchor: Math.min(text.length, props.initialSelection.anchor), head: Math.min(text.length, props.initialSelection.head) } }
  })
  const editor = useRef<EditorView | null>(null)
  const callbacks = useRef(props)
  const completion = useSQLCompletionPopup()
  const { update: updateCompletion } = completion
  useLayoutEffect(() => {
    callbacks.current = props
  }, [props])
  useLayoutEffect(() => {
    const view = editor.current
    const next = singleLine(value)
    if (view && next !== view.state.doc.toString()) {
      closeCompletion(view)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next }, selection: { anchor: next.length }, annotations: ExternalChange.of(true) })
    }
    if (view && disabled) closeCompletion(view)
  }, [value, disabled])
  useLayoutEffect(() => () => callbacks.current.onViewChange(null), [])
  const keydown = useCallback((event: KeyboardEvent, view: EditorView) => {
    if (event.isComposing || view.composing || event.altKey || callbacks.current.disabled) return false
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() !== 'l') return false
      closeCompletion(view)
      callbacks.current.onClear()
      return true
    }
    const status = completionStatus(view.state)
    if (event.key === 'Enter') {
      if (status) acceptCompletion(view)
      else callbacks.current.onExecute()
      return true
    }
    if (event.key === 'Tab' && status) {
      acceptCompletion(view)
      return true
    }
    if (!status && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      callbacks.current.onRecall(event.key === 'ArrowUp' ? -1 : 1)
      return true
    }
    return false
  }, [])
  const extensions = useMemo(
    () => [
      appearance,
      localCompletion,
      ...completion.extensions,
      EditorState.changeFilter.of((transaction) => transaction.newDoc.lines === 1 && transaction.newDoc.length <= terminalCommandLimit),
      EditorView.clipboardInputFilter.of(singleLine)
    ],
    [completion.extensions]
  )
  const onChange = useCallback((next: string) => callbacks.current.onChange(next), [])
  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      updateCompletion(update)
      if (update.docChanged || update.selectionSet) {
        const { anchor, head } = update.state.selection.main
        callbacks.current.onSelectionChange({ anchor, head })
      }
    },
    [updateCompletion]
  )
  const onCreateEditor = useCallback((view: EditorView) => {
    editor.current = view
    callbacks.current.onViewChange(view)
  }, [])

  return (
    <>
      <CodeMirror
        value={initial.value}
        selection={initial.selection}
        theme={themeMode}
        extensions={extensions}
        basicSetup={false}
        indentWithTab={false}
        readOnly={disabled}
        onChange={onChange}
        onUpdate={onUpdate}
        onCreateEditor={onCreateEditor}
        onKeyDownCapture={(event) => {
          const view = editor.current
          if (view && keydown(event.nativeEvent, view)) event.preventDefault()
        }}
        aria-label={t('Redis 命令')}
        style={{ flex: 1, minWidth: 0 }}
      />
      <SQLCompletionSelect completion={completion} objectKinds={objectKinds} label={t('Redis 命令')} />
    </>
  )
}
