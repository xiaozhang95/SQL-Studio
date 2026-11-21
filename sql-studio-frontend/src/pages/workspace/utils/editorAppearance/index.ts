import { EditorView } from '@codemirror/view'

export const sqlPreviewLayout = { lineHeight: 1.4, paddingBlock: 4 } as const

// CodeMirror 提供原生样式扩展；编辑器内部外观不进入全局 Ant Design 覆盖文件。
export const sqlEditorAppearance = EditorView.theme({
  '&.cm-editor': {
    height: '100%',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 'var(--ant-font-size)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.72' },
  '.cm-content': { padding: '10px 0 24px' },
  '.cm-line': { padding: '0 16px 0 12px' },
  '&.cm-editor .cm-gutters': {
    background: 'var(--surface)',
    color: 'var(--ant-color-text-quaternary)',
    borderRight: '0',
    fontSize: '0.84em'
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 8px' },
  '.cm-activeLine': { background: 'var(--surface-subtle)' },
  '.cm-activeLineGutter': { background: 'var(--surface-subtle)', color: 'var(--text-tertiary)', boxShadow: 'inset 2px 0 0 var(--primary)' },
  '.cm-keyword': { color: 'var(--code-keyword)' },
  '.cm-string': { color: 'var(--code-string)' },
  '.cm-number': { color: 'var(--code-number)' },
  '.cm-comment': { color: 'var(--code-comment)', fontStyle: 'italic' },
  '.cm-variableName, .cm-propertyName, .cm-punctuation': { color: 'var(--text)' },
  '.cm-operator': { color: 'var(--text-secondary)' },
  '.cm-typeName, .cm-bool, .cm-atom, .cm-null': { color: 'var(--code-type)' },
  '.cm-selectionBackground': { background: 'var(--ant-control-item-bg-active)' },
  '&.cm-focused .cm-selectionBackground': { background: 'var(--ant-control-item-bg-active)' },
  '.ai-ghost': { color: 'var(--ant-color-text-quaternary)', whiteSpace: 'pre-wrap', pointerEvents: 'none' }
})

/** 只读文本按全文展开，滚动归属外层表格或弹窗。 */
export const sqlPreviewAppearance = EditorView.theme({
  '&.cm-editor': { background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', fontSize: 'inherit', lineHeight: sqlPreviewLayout.lineHeight, overflow: 'visible' },
  '.cm-content': { paddingBlock: `${sqlPreviewLayout.paddingBlock}px` }
})