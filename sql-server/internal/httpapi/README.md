# Gin HTTP 接口

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

注册路由、解析参数、限制 JSON、同源及本机保护，并统一错误响应。

## 约束与调用

只调用 service，不直接开数据库或读文件；路径/字段契约见根目录 docs/API.md。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
