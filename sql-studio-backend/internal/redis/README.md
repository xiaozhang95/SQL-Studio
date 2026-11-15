# Redis 引擎

`NewClient()` 使用 go-redis 连接单个 Redis 实例。连接使用独立的逻辑库、可选 ACL 用户名和密码，并支持按主机名验证的 TLS。普通操作随请求释放连接，禁用命令自动重试。测试先执行 PING，INFO 权限可用时显示服务端版本。

`Keys` 返回一页 SCAN 结果。`Key` 返回类型、TTL、大小和有界预览，支持 string、hash、list、set、zset 和 stream。二进制名称以 Base64 保留身份。其他类型可查看类型与 TTL。`KeyTTL` 单独执行 PTTL 获取详情刷新所需的剩余毫秒数。`Run` 执行单条命令，SELECT 校验新逻辑库后返回其编号。

`Channels` 读取实例活跃频道和模式订阅计数。`Subscribe` 维持独立订阅连接，确认订阅后输出消息和心跳，取消即释放。`Monitor` 解析 INFO 并返回实例指标。

`Databases(ctx, connection)` 读取 `CONFIG GET databases` 并返回从 0 开始的编号（含空库）。服务限制 CONFIG 时，以独立连接通过 SELECT 查询范围，保留普通连接默认的 0 号库，并继承元数据超时和取消信号。

`ChangeKey` 根据连接和逻辑库修改一个键。重命名、复制使用 Redis 的原生无覆盖命令，删除使用 UNLINK。TTL 以整数秒设置，0 表示移除过期时间。新增使用 SET NX，避免覆盖同名键。字符串编辑检查值类型、UTF-8、大小和可选的旧值，通过 WATCH 同时监视源键与可选的目标键。事务中用 SET XX 一并更新值和 TTL，需要改名时再执行 RENAMENX。省略 TTL 时使用 KEEPTTL 保留过期时间。

命令回执同时提供终端文本与查询表。标量、空值和列表使用 value 列，HGETALL、HMGET、MGET 以及带 WITHSCORES 的区间查询提供对应的字段、键名或分数列。结果表保留整数文本并限制返回行数和输出大小。
