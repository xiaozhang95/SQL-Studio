# 编辑器外观扩展

sqlEditorAppearance、sqlPreviewAppearance 为 CodeMirror 原生 EditorView.theme 扩展，由 QueryEditor/SQLPreview 添加到 extensions。无入参、无业务状态或副作用，编辑器界面颜色引用当前主题 token。语法高亮沿用 CodeMirror 随亮暗主题提供的高亮扩展。

编辑器与只读预览使用系统默认字体，字号直接使用全局界面字号；行号栏背景贴齐侧栏分隔线。行号栏按实际行数自适应宽度、使用浅色数字。当前行的行号在亮暗主题中共用 `--surface-selected` 中性底，左侧显示 2px 主色竖线。行号与代码之间保留一条主题次级边框竖线分隔，不留额外占位。选区使用主色半透明变量。编辑器顶部内边距收紧为 6px，使首行贴近工具栏；只读扩展保持全文展开和自动换行所需的可见溢出。补全弹层由 sqlCompletionSelect 使用 Ant Design Select 展示，并读取当前编辑区字体。扩展只作用于使用它的编辑器，不改变语言、请求或 SQL 执行行为。
