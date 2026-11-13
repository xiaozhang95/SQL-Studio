# SQL 只读预览

[组件索引](../README.md) · [源码](index.tsx)

SQLPreview 接收 sql:string、themeMode:ThemeMode、可选 databaseType、compact:boolean（默认 false）、panel:boolean（默认 false）、title:string（默认 SQL）。数据库适配器提供语言扩展，CodeMirror 只读且禁用补全，不修改草稿或执行 SQL。

memo 复用相同内容/主题的预览，basicSetup 保持稳定，避免输入 SQL 或打开树时重配历史和结果中的只读编辑器。

所有调用完整显示 SQL，保留换行并自动折行；不提供固定高度、最大高度或首行截断参数，不产生编辑器内部滚动条。结果表格、消息区、历史抽屉和对象/优化弹窗各自负责外层滚动。容器布局使用组件 style，编辑器内部使用 [editorAppearance](../../utils/editorAppearance/README.md) 的 CodeMirror 原生样式扩展。

compact 在 SQL 首行旁显示复制图标。panel 使用 small Card 标题栏放置 title 和复制按钮，与 Agent 代码卡片共用公共 ContentCard 的外框。默认展示在 SQL 上方显示标题与复制按钮。复制使用原始全文，失败在预览中通过全局 ErrorNotice 提示。

复制入口复用 ToolbarButton 的 small 无边框图标按钮，Tooltip 和 aria-label 均为“复制 SQL”，与工作区其他操作保持一致。

面板模式复用公共 ContentCard 的 code 模式，外框和正文布局通过 style/styles 管理。
