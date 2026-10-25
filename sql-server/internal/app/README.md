# 应用装配

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

`New(cfg config.Config) (*App, error)` 创建连接仓库、MySQL 客户端，以及 connections/metadata/query 三个独立模块，通过 httpapi.Services 注入同一个 Gin API，组合静态网页和 HTTP 生命周期；初始化失败原样返回错误。

## 约束与调用

只在 app 装配具体实现；模块通过自己的最小接口消费同一个仓库和客户端，query 只创建一次以共享并发预算。启动不覆盖已有连接；`Run(ctx context.Context) error` 收到取消信号时给予在途请求 5 秒结束时间，不在模块之间创建网络调用。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
