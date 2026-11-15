# Redis 查询工具

`New(repository, engine)` 注入保存连接查找器与 Redis 引擎。接口按显式连接 ID 校验 Redis 类型。键列表使用 SCAN 游标和模式，详情使用无损编码的键引用。命令解析支持 redis-cli 风格的引号与转义，逻辑库缺省为连接配置或 0。

Keys、Key、Run 和 Channels 为单次调用，超时 8 秒。Subscribe 在请求取消时结束，为消息和状态发出 NDJSON 使用的领域事件。连接测试和实例监控继续使用通用连接与元数据入口。

`ChangeKey(ctx,id,database,ref,change)` 复用连接、范围和二进制键引用校验。新增接受目标键名、值和 TTL，允许省略引用。编辑字符串可提交新键名和 TTL，省略 TTL 则保留期限。以 8 秒期限调用引擎，新增、改名或复制成功时返回目标键引用。

`KeyTTL(ctx,id,database,ref)` 验证现有键引用并单独读取剩余毫秒数，返回 -1 表示永久，-2 表示键不存在。
