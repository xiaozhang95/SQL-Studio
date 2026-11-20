# 查询收藏存储

`listQueryFavorites(refresh?)` 读取并校验 `query-favorites` 配置分区的 `{ items: QueryFavorite[] }`。首次缺失时使用空列表，损坏时拒绝覆盖。 `changeQueryFavorites(change)` 写入单次列表变更，版本冲突时读取最新修订并重放当前变更一次，保留其他窗口已写入的记录。
