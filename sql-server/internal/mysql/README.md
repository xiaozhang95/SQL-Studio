# MySQL 协议驱动

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

MySQL 的连接测试、结构读取、DDL 与 SQL 执行。

## 约束与调用

SQL 默认只读事务，单语句执行；结果行数/约 8MiB 限制，保留 BIGINT/DECIMAL 精度与 NULL；标识符严格转义。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
