# SQL 只读预览

[组件索引](../README.md) · [源码](index.tsx)

SQLPreview 接收 sql:string、themeMode:ThemeMode、可选 databaseType、compact:boolean（默认 false）、panel:boolean（默认 false）、title:string（默认 SQL）。数据库适配器提供语言扩展，CodeMirror 只读且禁用补全，不修改草稿或执行 SQL。

所有调用完整显示 SQL，保留换行并自动折行；不提供固定高度、最大高度或首行截断参数，不产生编辑器内部滚动条。结果表格、消息区、历史抽屉和对象/优化弹窗各自负责外层滚动。容器布局使用组件 style，编辑器内部使用 [editorAppearance](../../utils/editorAppearance/README.md) 的 CodeMirror 原生样式扩展。

compact 在 SQL 首行旁显示复制图标；panel 使用原生 small Card 标题栏放置 title 和复制按钮。默认展示在 SQL 上方显示标题与复制按钮。复制始终使用原始全文，成功或失败通过 AntApp message 反馈；无异步请求、缓存或可变业务状态。
