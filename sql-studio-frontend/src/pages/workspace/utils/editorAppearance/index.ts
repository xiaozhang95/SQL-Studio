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
  '.cm-content': { padding: '6px 0 28px' },
  '.cm-line': { padding: '0 20px 0 8px' },
  '&.cm-editor .cm-gutters': {
    background: 'var(--surface)',
    color: 'var(--ant-color-text-tertiary)',
    borderRight: '1px solid var(--border)'
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 20px' },
  '.cm-activeLine': { background: 'transparent' },
  '&.cm-editor .cm-activeLineGutter': {
    backgroundColor: 'var(--surface-selected)',
    color: 'var(--primary)',
    fontWeight: '500',
    boxShadow: 'inset 2px 0 0 var(--primary)'
  },
  '.cm-selectionBackground': { background: 'var(--selection)' },
  '&.cm-focused .cm-selectionBackground': { background: 'var(--selection)' },
  '.ai-ghost': { color: 'var(--ant-color-text-tertiary)', whiteSpace: 'pre-wrap', pointerEvents: 'none' }
})

/** 只读文本按全文展开，滚动归属外层表格或弹窗。 */
export const sqlPreviewAppearance = EditorView.theme({
  '&.cm-editor': {
    background: 'transparent',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 'var(--ant-font-size)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', fontSize: 'inherit', lineHeight: sqlPreviewLayout.lineHeight, overflow: 'visible' },
  '.cm-content': { paddingBlock: `${sqlPreviewLayout.paddingBlock}px` }
})
