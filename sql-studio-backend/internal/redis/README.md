# Redis 引擎

`NewClient()` 使用 go-redis 连接单机、哨兵或集群。哨兵按主节点名称发现主节点，Redis 和哨兵可以分别配置认证。集群由种子节点发现拓扑并按槽路由。各模式支持校验证书和节点主机名的 TLS。普通操作随请求释放连接，禁用命令自动重试。测试先执行 PING，INFO 权限可用时显示服务端版本。

`SetSession(ctx, connection, database, open)` 管理当前客户端拥有的请求。关闭等待对应的命令、键操作或实例请求释放资源，重新打开先验证连通性。实例级请求包含逻辑库列表、监控和发布订阅，随整个连接关闭。关闭单个逻辑库只阻止该库的操作及切入该库的 SELECT。

`Keys` 返回一页 SCAN 结果，键引用可无损定位二进制键名。`Key` 返回类型、TTL、大小和有界预览，支持 string、hash、list、set、zset 和 stream。字符串预览沿 UTF-8 字符边界截断，无效 UTF-8 内容显示为 Base64。完整 UTF-8 String/List/Set/Hash/ZSet 在 16KiB、最多 50 个集合元素以内标为 editable；无序集合按成员/字段排序，保证旧值比较稳定。List 保留元素顺序，Hash/ZSet 使用二元字符串数组，ZSet 分数须为有限数。截断、二进制、Stream 和未知类型保留只读预览。`KeyTTL` 单独执行 PTTL 获取详情刷新所需的剩余毫秒数。`Run` 执行单条命令，SELECT 校验新逻辑库后返回其编号。

`Channels` 读取实例活跃频道和模式订阅计数。`Subscribe` 维持独立订阅连接，确认订阅后输出消息和心跳，取消即释放。`Monitor` 在同一请求中读取一次默认 INFO，返回客户端、吞吐、内存/RSS/峰值/碎片率、连接、网络速率及累计流量、命令、过期/淘汰、命中率等实例指标。附带版本/模式/角色/runId、服务器/客户端/内存/持久化/复制/运行统计/CPU 的白名单字段，以及 INFO 非空逻辑库的键数、带期限键数、平均 TTL（毫秒）。键数用 big.Int 汇总并返回字符串。缺失字段省略，未返回 Keyspace 时 keyspaces=null，返回空节时为 [] 且总键数为 0。不扫描键、不执行 CONFIG、不汇总集群其他节点；沿用请求取消、连接关闭和元数据超时。

`Databases(ctx, connection)` 对单机或哨兵读取 `CONFIG GET databases` 并返回含空库的逻辑编号，受限时以独立连接通过 SELECT 查询可用范围。集群探测成功后仅返回 DB 0。集群键浏览在主节点上逐页 SCAN，游标绑定主节点地址及筛选条件。频道列表汇总集群节点，监控明确标注采样的主节点地址。跨槽多键操作使用 Redis 的原有错误语义。

`ChangeKey` 根据连接和逻辑库修改一个键。重命名、复制使用 Redis 的原生无覆盖命令，删除使用 UNLINK。TTL 以整数秒设置，0 表示移除过期时间。新增使用 SET NX，避免覆盖同名键。值编辑检查 valueType、UTF-8、大小和旧值，通过 WATCH 同时监视源键与可选的目标键。String 用 SET XX/KEEPTTL；List 用 LSET/RPUSH/LTRIM，Set 用 SADD/SREM，Hash 用 HSET/HDEL，ZSet 用 ZADD/ZREM，在原类型内修改。集合先新增再移除旧成员，避免替换时短暂变空而丢失 TTL；拒绝空集合及重复成员/字段。省略 TTL 不调整期限，指定时同事务更新；需要改名时再执行 RENAMENX。冲突拒绝写入，不自动重试。Redis 事务错误和取消不描述为已经回滚。

rename 携带 TTL 时，通过 WATCH 监视源键和目标键，检查源键存在且目标不存在，再在同一 MULTI/EXEC 内执行 RENAMENX 与目标键的 EXPIRE/PERSIST；0 移除期限。省略 TTL 时继续使用原生 RENAMENX 并保留期限。冲突拒绝写入，不自动重试。

命令回执同时提供终端文本与查询表。标量、空值和列表使用 value 列，HGETALL、HMGET、MGET 以及带 WITHSCORES 的区间查询提供对应的字段、键名或分数列。结果表保留整数文本并限制返回行数和输出大小。
