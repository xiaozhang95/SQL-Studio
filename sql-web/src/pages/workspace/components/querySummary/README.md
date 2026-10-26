# querySummary

[组件索引](../README.md) · [源码](index.tsx)

QuerySummary 接收 run:RunState、running:boolean、themeMode:ThemeMode 和可选 databaseType。汇总已处理/总数、成功、错误、开始/结束时间及批次运行耗时，下方按语句显示高亮可复制 SQL、消息和查询耗时。仅显示错误为组件内筛选，不影响结果选择。旧快照缺少时序字段显示未记录，不伪造获取耗时。表格自身横向滚动，外层容器负责纵向滚动。

查询列采用 SQLPreview compact 模式，第一行并排显示实际 SQL 与一个复制图标按钮，不额外显示 SQL 标题或复制 SQL 文案。
