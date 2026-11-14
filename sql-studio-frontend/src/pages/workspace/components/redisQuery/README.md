# Redis 查询工具

`RedisQuery` 渲染在统一的查询标签内，接收连接、页签范围和主题。左侧是连接及逻辑库选择、编辑器运行，以及命令行、发布订阅和键详情图标。再次点击当前工具返回编辑器。Redis 标签的连接选择只提供已保存的 Redis。

[编辑器](components/editor/README.md)复用工作区文档草稿和位置保存。[终端](components/console/README.md)按标签和连接保存草稿、历史及回执，当前工具随浏览器刷新恢复。[发布订阅](components/pubsub/README.md)在工具切换时保留实时请求。关闭标签或切换连接时释放旧范围的请求。使用 SELECT 更新发起标签的数据库。
