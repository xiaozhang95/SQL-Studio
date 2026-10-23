# 应用装配

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

创建连接仓库、MySQL/PostgreSQL 驱动及服务，注入 Gin API，组合静态网页和 HTTP 生命周期。

## 约束与调用

只在 app 装配具体实现；启动不覆盖已有连接，取消时有界关闭 HTTP 服务。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
