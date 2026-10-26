# 单体业务模块

每个模块独立维护业务入口、消费接口、规则及测试；均在一个 Go 进程内运行，由 app 注入依赖，不在模块之间发 HTTP/RPC 请求。

- [connections](connections/README.md)：连接管理、分组、校验及连通性测试。
- [metadata](metadata/README.md)：数据库、表、字段及 DDL 读取。
- [query](query/README.md)：SQL 查询的行数、超时和并发限制。

模块只依赖共享 model 与自己声明的接口，不导入兄弟模块、Gin、具体数据库驱动或文件仓库。当前三个模块通过接口复用同一个连接仓库和 MySQL 客户端；每个请求都携带明确的连接 ID。跨模块编排放 app，不暴露内部字段作为共享可变状态。不为未来需求预建服务发现、网关、消息队列或独立部署配置。

- [settings](settings/README.md)：用户配置输入边界与分区读写。

- [ai](ai/README.md)：SQL 灰色续写和手动优化，独立并发与取消。
