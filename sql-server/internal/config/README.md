# 运行配置

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

统一读取环境变量与解析数据/网页目录，校验首次连接参数。

## 约束与调用

下层通过参数接收配置，不在 handler/service 中重复读取环境变量。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
