# Redis 查询工具

`New(repository, engine)` 注入保存连接查找器与 Redis 引擎。接口按显式连接 ID 校验 Redis 类型。键列表使用 SCAN 游标和模式，详情使用无损编码的键引用。命令解析支持 redis-cli 风格的引号与转义，逻辑库缺省为连接配置或 0。

Keys、Key、Run 和 Channels 为单次调用，超时 8 秒。Subscribe 在请求取消时结束，为消息和状态发出 NDJSON 使用的领域事件。连接测试和实例监控继续使用通用连接与元数据入口。

`ChangeKey(ctx,id,database,ref,change)` 复用连接、范围和二进制键引用校验。验证动作和参数后，以 8 秒期限调用对应引擎操作。
