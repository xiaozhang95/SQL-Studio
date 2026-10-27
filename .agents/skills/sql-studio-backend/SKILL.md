---
name: sql-studio-backend
description: 开发和维护 SQL Studio 的 Go Gin 模块化单体后端；用于连接管理、数据库对象、SQL 查询、MySQL 引擎、API、存储、模块重构及后端脚本日志清理，不用于纯前端任务。
---

# SQL Studio 后端开发

适用于本仓库 `sql-studio-backend`。先读[后端规范](../../../docs/BACKEND_STANDARDS.md)、[架构](../../../docs/BACKEND_ARCHITECTURE.md)、[包索引](../../../sql-studio-backend/internal/README.md)，再读目标包 README；用户最新要求优先。

## 模块化单体

- 保留一个 Go module、启动入口、进程和 HTTP 服务。按业务功能建立独立模块，采用明确职责与契约边界，在进程内装配；当前不引入内部 HTTP/RPC、网关、服务发现、消息队列、容器或多服务部署配置。
- [modules](../../../sql-studio-backend/internal/modules/README.md) 的 connections、metadata、query 分别拥有业务实现、消费接口、常量和测试。模块只依赖 model，不直接导入兄弟模块、Gin、驱动或具体存储；需要什么接口，由消费模块声明并由 app 注入。不重建大而全的 service 或旧路径转发层。
- app 组合具体实现并拥有资源生命周期；main.go 只加载配置、装配和处理退出；httpapi 只解码、调用模块公开方法和编码，不承载业务规则、SQL 或文件读写。query 在启动时创建一次，所有请求共用并发预算。

## 包、类型与引擎

- 一个实际功能一个包，包内按职责分文件，源码与单元测试同目录；保留 Go 原生命名与 gofmt，不套前端 index 规则或为局部 helper 建空包。每个实际包有 README.md 与 doc.go，父目录提供索引。
- README 说明职责、构造器/公开方法、参数类型与默认值、返回值、错误、超时/取消、并发和缓存归属。迁移同步调用者、索引、[API](../../../docs/API.md) 及架构测试。
- 使用命名类型、struct、const、最小接口及 errors.Is/As 约束边界。跨模块共享契约放 model，私有定义留本模块；不用无约束 any 或任意 map 替代已知业务结构，外部输入做运行时校验。
- MySQL 专属连接、TLS、语句识别、元数据及执行留在 internal/mysql；连接加密落盘在 internal/connection，环境变量集中在 internal/config。当前只支持 MySQL，不预建未支持引擎的空包或注册框架。

## 行为边界

明确传递连接 ID 和对象范围，context 从请求传到驱动，保留取消、超时、游标与连接释放。保持默认只读、单语句、行数/字节/并发限制和精确数值文本；前端多语句仍是多个独立单语句请求。取消不能当作事务已回滚。

密码不进入响应或日志；编辑空密码保留原值，密钥丢失拒绝覆盖。API、本地连接格式和现有数据在重构时保持兼容；不因清理日志或生成文件删除 data/、密钥或连接记录。

## 原生命令与验证

从 `sql-studio-backend` 执行 `go run ./cmd/sql-studio-backend/main.go`，日志输出终端，Ctrl+C 退出；当前不增加启停/检查包装脚本、后台 PID 或部署配置。保留运行必需的 config、go.mod/go.sum 和有效测试；自动化配置待实际需求再添加。

使用 `gofmt -w .`、`gofmt -l .`、`go test -count=1 ./...`、`go vet ./...`、`go build ./...`；架构测试约束真实包路径、模块独立与递归 README/doc.go。行为变化使用测试替身和临时目录验证。真实数据库集成默认跳过，仅在明确授权时启用，并限随机临时库，不读取业务表完成检查。

核对归属后清理不用的脚本、日志和本次临时验证产物；保留源码、测试及用户数据。报告实际验证和未覆盖范围。此 skill 不要求额外审批，也不授权提交、部署、发送消息或修改业务数据。
