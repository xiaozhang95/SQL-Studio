# queryMessages

[组件索引](../README.md) · [源码](index.tsx)

QueryMessages 接收 run:RunState、running:boolean、themeMode:ThemeMode 和可选 databaseType，按执行顺序展示本批 SQL、成功/错误与查询耗时。SQL 通过 sqlPreview 只读高亮并支持复制；执行时展示已完成消息和进行中提示。兼容未保存 SQL 的旧结果。不修改结果选择和数据库状态。

SQL 使用 compact 变体，复制图标与摘要、历史及 DDL 一致，不额外显示 SQL 标题及复制 SQL 文本按钮。

每条 SQL 的复制图标位于其左侧，紧邻首行；不随消息区宽度移到最右端，短语句和多条执行消息也能明确对应。

成功消息按是否有结果列区分查询结果与纯执行回执，兼容旧无列成功记录，不依赖错误的历史 isQuery 标志。

每条完成语句使用 Ant Design Collapse 独立折叠，标题显示序号、成功/失败图标及文案和耗时；默认展开错误项、收起成功项，正文保留 SQL 复制与完整回执。新批次按 run.id 重置折叠状态。
