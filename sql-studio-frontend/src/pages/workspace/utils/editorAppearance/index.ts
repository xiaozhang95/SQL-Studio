import { EditorView } from '@codemirror/view'

// CodeMirror 提供原生样式扩展；编辑器内部外观不进入全局 Ant Design 覆盖文件。
export const sqlEditorAppearance = EditorView.theme({
  '&.cm-editor': { height: '100%', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit' },
  '&.cm-editor .cm-gutters': { background: 'var(--surface-raised)', color: 'var(--text)', borderRight: '1px solid var(--border)' },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    width: 'max-content',
    minWidth: '220px',
    maxWidth: 'min(400px, calc(100vw - 32px))',
    border: '1px solid var(--ant-color-border-secondary)',
    borderRadius: '0',
    background: 'var(--ant-color-bg-elevated)',
    color: 'var(--text)',
    boxShadow: 'var(--ant-box-shadow-secondary)',
    overflow: 'hidden'
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { minWidth: '220px', maxWidth: '100%', maxHeight: '240px', height: 'auto', fontFamily: 'inherit', fontSize: 'var(--ant-font-size)', padding: '4px' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '5px 12px', minHeight: '32px', lineHeight: 'var(--ant-line-height)', borderRadius: '0' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li:hover': { background: 'var(--ant-control-item-bg-hover)' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected="true"]': { background: 'var(--ant-control-item-bg-active)', color: 'var(--ant-color-text)' },
  '.cm-completionLabel, .cm-completionDetail': { fontStyle: 'normal' },
  '.cm-completionDetail': { color: 'var(--ant-color-text-description)' },
  '.cm-completionIcon': { display: 'none' },
  '.cm-completionMatchedText': { textDecoration: 'none', fontWeight: '600' },
  '.ai-ghost': { color: 'var(--ant-color-text-quaternary)', whiteSpace: 'pre-wrap', pointerEvents: 'none' }
})

/** 只读文本按全文展开，滚动归属外层表格或弹窗。 */
export const sqlPreviewAppearance = EditorView.theme({
  '&.cm-editor': { background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', fontSize: 'inherit', overflow: 'visible' },
  '.cm-content': { paddingBlock: '4px' }
})
