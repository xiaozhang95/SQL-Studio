# 业务策略与接口

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

ConnectionRepository/Database 为本层声明的接口；直接注入 MySQL 实现，编排连接、结构与 SQL。

## 约束与调用

查询默认 1000 行/最大 5000 行、30 秒、4 并发，元数据 10 秒；不依赖 Gin、SQL 驱动或文件系统。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
