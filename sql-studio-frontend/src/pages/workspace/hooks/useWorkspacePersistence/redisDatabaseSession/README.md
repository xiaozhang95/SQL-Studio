# Redis 逻辑库刷新恢复

`rememberRedisDatabases(current, saved, inFlight, connections)` 对照当前页面、已保存索引和正在提交的索引，使用 `sessionStorage` 暂存已有 Redis 查询标签的库编号变化。只记录标签 ID、连接 ID 和库编号。返回前清理已保存、已关闭或已切换连接的记录。

`restoreRedisDatabases(tabs)` 仅在标签、连接和先前库编号匹配时返回更新后的标签数组。浏览器存储不可用时使用服务端索引；`clearRedisDatabaseSession()` 在工作区版本冲突时丢弃暂存记录。
