# 编辑器外观扩展

sqlEditorAppearance、sqlPreviewAppearance 为 CodeMirror 原生 EditorView.theme 扩展，由 QueryEditor/SQLPreview 添加到 extensions。无入参、无业务状态或副作用，颜色引用当前主题 token，字体继承页面。

编辑器扩展管理全高、行号、补全弹层和 AI 建议外观；只读扩展保持全文展开和自动换行所需的可见溢出。只作用于使用扩展的编辑器，不向 app.scss 写入 CodeMirror 内部覆盖，不改变语言、请求或 SQL 执行行为。
