# 编辑器外观扩展

sqlEditorAppearance、sqlPreviewAppearance 为 CodeMirror 原生 EditorView.theme 扩展，由 QueryEditor/SQLPreview 添加到 extensions。无入参、无业务状态或副作用，颜色引用当前主题 token。

编辑器与只读预览使用系统默认字体，字号直接使用全局界面字号；行号栏背景贴齐侧栏分隔线，行号内容左侧保留与上方工具栏一致的 16px 内缩，行号和代码位置不变。行号栏按实际行数自适应宽度、使用浅色数字；当前行只高亮行号，并在行号栏左侧显示 2px 主色竖线，代码行本身不加背景或竖条；行号与代码之间保留一条主题次级边框竖线分隔，不留额外占位。选区使用主色半透明变量。编辑器顶部内边距收紧为 6px，使首行贴近工具栏；只读扩展保持全文展开和自动换行所需的可见溢出。补全弹层由 sqlCompletionSelect 使用 Ant Design Select 展示，并读取当前编辑区字体。扩展只作用于使用它的编辑器，不改变语言、请求或 SQL 执行行为。
