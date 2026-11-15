# 查询工具栏

`QueryToolbar` 接收当前查询页的范围、已保存的连接和对象元数据。SQL 与 Redis 共用左侧连接和库下拉。调用者可在 `runActions` 提供左侧按钮，通过 children 提供右侧操作图标。Redis 使用 `compact` 收缩两个下拉的宽度，连接、库和运行按钮保持同行。
