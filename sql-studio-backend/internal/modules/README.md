# 单体业务模块

每个模块独立维护业务入口、消费接口、规则及测试；均在一个 Go 进程内运行，由 app 注入依赖，不在模块之间发 HTTP/RPC 请求。

- [connections](connections/README.md)：连接管理、分组、校验及连通性测试。
- [metadata](metadata/README.md)：数据库、表、字段及 DDL 读取。
- [query](query/README.md)：SQL 查询的行数、超时和并发限制。

模块只依赖共享 model 与自己声明的接口，不导入兄弟模块、Gin、具体数据库驱动或文件仓库。app 按需注入同一个连接仓库、MySQL 客户端、配置仓库与 AI 客户端；数据库请求携带明确的连接 ID。跨模块编排放 app，不暴露内部字段作为共享可变状态。不为未来需求预建服务发现、网关、消息队列或独立部署配置。

- [settings](settings/README.md)：用户配置输入边界与分区读写。

- [ai](ai/README.md)：SQL 灰色续写和手动优化，独立并发与取消。

- [workspace](workspace/README.md)：分片工作区索引、按需内容和增量提交。

- [agent](agent/README.md)：纯聊天工具编排。
- [agentlayout](agentlayout/README.md)：Agent本地布局，恢复不执行工具。
