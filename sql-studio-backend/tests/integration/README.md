# 真实 MySQL 回归

设置 SQLDESK_INTEGRATION=1 后执行 go test ./...。SQLDESK_MYSQL_PORT 可指定隔离实例的宿主映射端口（默认 3306），其他连接参数见后端 README。测试仅创建随机临时库并在结束后清理，不使用业务表；未启用时跳过，不将跳过报告为联调通过。

MariaDB 真实回归为 mariadb_test.go，使用 SQLDESK_MARIADB_INTEGRATION=1 及 SQLDESK_MARIADB_PASSWORD，可选 HOST/PORT（同前缀，默认 127.0.0.1:3307）。测试创建随机临时库并核验删除；覆盖 MariaDB 特有默认值、生成列、RETURNING、元数据、流式读取和实际 HTTP 分派，不读取业务数据。

GreptimeDB 真实回归为 greptimedb_test.go。对本机隔离实例设置 `SQLDESK_GREPTIMEDB_INTEGRATION=1`，可用 `SQLDESK_GREPTIMEDB_PORT` 指定宿主映射端口（默认 4002）。启用鉴权时设置同前缀的 `USERNAME` 和 `PASSWORD`。运行 `go test -count=1 -v ./tests/integration -run '^TestGreptimeDBIntegration$'`，覆盖视图投影字段、普通表 TIME INDEX 和双引号 USE，结束时核验随机临时库已删除。

MySQL 同步实库测试使用 `SQLDESK_SYNC_INTEGRATION=1`、`SQLDESK_MYSQL_PORT`、`SQLDESK_SYNC_TARGET_PORT` 和两台隔离实例共用的 `SQLDESK_MYSQL_PASSWORD`。执行 `go test -count=1 ./tests/integration -run TestMySQLDatabaseSync`，验证只读检查、显式自动提交、源表元数据锁、同名库并发争抢、受限权限、强制只读、跨库外键、取消后恢复，以及约 31 MiB 数据的逐行哈希和单行大小限制。
