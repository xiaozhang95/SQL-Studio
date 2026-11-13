# querySummary

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[组件索引](../README.md) · [源码](index.tsx)

QuerySummary 接收 run:RunState、running:boolean、themeMode:ThemeMode 和可选 databaseType。汇总已处理/总数、成功、错误、开始/结束时间及批次运行耗时，下方按语句显示高亮可复制 SQL、消息和查询耗时。仅显示错误为组件内筛选，不影响结果选择。旧快照缺少时序字段显示未记录，不伪造获取耗时。表格自身横向滚动，外层容器负责纵向滚动。

查询列采用 SQLPreview compact 模式，第一行并排显示实际 SQL 与复制图标。错误消息使用全局 ErrorNotice。

摘要使用共享分页外观，每页 50 条，所有执行记录均保留，避免批量导入一次挂载数百个 SQL 预览；勾选“仅显示错误”回到第一页。新输出版本由父组件 key 重置分页和筛选。无结果列的成功回执显示实际影响行数。
