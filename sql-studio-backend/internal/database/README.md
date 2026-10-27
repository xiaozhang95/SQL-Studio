# 数据库分派

[包索引](../README.md) · [源码](client.go)

Engine 声明连接测试、会话、库表/字段/索引/DDL 与 Execute 的最小跨引擎集合。New(map[string]Engine) 复制注册表，app 注入实际实现；本包只依赖 model，不导入具体引擎。每次按 Connection.Type 选择实现，空类型兼容 MySQL，未知类型返回错误，绝不回退到其他引擎。

Client 透传 connection ID、库表、请求限制、context 与原始返回值/错误；自身不拼 SQL、不管理密码、超时、并发预算或连接资源。各引擎管理自己的生命周期，业务模块继续声明并消费原有最小接口。测试用替身验证分派与取消，不访问网络或真实数据库。

Engine/Client.Schemas 透传显式连接和数据库到所属引擎；不推断 schema、不改写对象名称。
