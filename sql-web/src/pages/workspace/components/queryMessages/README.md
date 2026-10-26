# queryMessages

[组件索引](../README.md) · [源码](index.tsx)

QueryMessages 接收 run:RunState、running:boolean、themeMode:ThemeMode 和可选 databaseType，按执行顺序展示本批 SQL、成功/错误与查询耗时。SQL 通过 sqlPreview 只读高亮并支持复制；执行时展示已完成消息和进行中提示。兼容未保存 SQL 的旧结果。不修改结果选择和数据库状态。
