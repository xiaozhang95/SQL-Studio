# 真实数据库回归

MySQL 与 PostgreSQL 分别由 SQLDESK_INTEGRATION、SQLDESK_PG_INTEGRATION 启用。测试仅创建随机临时库并清理，不使用业务表。

入口：后端 `设置 SQLDESK_INTEGRATION=1 后执行 go test ./...` / `-PostgresIntegration`。参数见后端 README；未启用时跳过，不将跳过报告为联调通过。PolarDB 在普通 PostgreSQL 上的协议验证不等于云实例和 Oracle 专有功能验证。
