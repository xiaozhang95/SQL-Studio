# sqlPreview

[组件索引](../README.md) · [源码](index.tsx)

SQLPreview 接收 sql:string、themeMode:ThemeMode 和可选 databaseType。复用数据库适配器语言扩展实现语法高亮，CodeMirror 只读、禁用补全，保留选择文本与复制 SQL 按钮与原生消息反馈。长文本自动换行且限定编辑器高度，复制成功提示 SQL 已复制，浏览器拒绝写入剪贴板时提示手动复制；不修改草稿，不执行查询。

compact?:boolean 默认 false。摘要传 true 时只显示高亮 SQL 与同排的图标复制按钮，去掉重复 SQL 标题和按钮文字；消息仍使用默认展示。复制按钮保留 title 和 aria-label，长 SQL 保留换行和滚动，不截断复制内容。

maxHeight?:string 默认 160px，控制只读编辑器最大高度；历史列表传 32px、详情传 240px，DDL 传 none，由结果表体统一纵向滚动。文本 aria-label 为 SQL 文本，适用于已执行 SQL 和只读 DDL。

singleLine?:boolean 默认 false；历史列表传 true，仅预览 SQL 首行、不启用软换行并隐藏横向滚动条，悬停可查看原 SQL。复制永远读取 sql 原值，详情与 DDL 不折叠换行。
