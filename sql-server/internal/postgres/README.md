# PostgreSQL 协议驱动

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

PostgreSQL、PolarDB PostgreSQL、PolarDB Oracle 兼容版的 pgx 连接、Schema 元数据和执行。

## 约束与调用

不是原生 Oracle 驱动。扩展查询保证单语句；默认只读；文本结果保留精度。DDL 是基础重建，不能当完整 pg_dump。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
