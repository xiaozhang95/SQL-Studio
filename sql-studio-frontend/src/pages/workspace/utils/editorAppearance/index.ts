import { EditorView } from '@codemirror/view'

// CodeMirror 提供原生样式扩展；编辑器内部外观不进入全局 Ant Design 覆盖文件。
export const sqlEditorAppearance = EditorView.theme({
  '&.cm-editor': { height: '100%', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '&.cm-editor .cm-gutters': { background: 'var(--surface-raised)', color: 'var(--text)', borderRight: '1px solid var(--border)' },
  '.ai-ghost': { color: 'var(--ant-color-text-quaternary)', whiteSpace: 'pre-wrap', pointerEvents: 'none' }
})

/** 只读文本按全文展开，滚动归属外层表格或弹窗。 */
export const sqlPreviewAppearance = EditorView.theme({
  '&.cm-editor': { background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', fontSize: 'inherit', overflow: 'visible' },
  '.cm-content': { paddingBlock: '4px' }
})
