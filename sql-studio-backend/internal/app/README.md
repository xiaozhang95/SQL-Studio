# 应用装配

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

`New(cfg config.Config) (*App, error)` 创建连接仓库、MySQL 客户端，以及 connections/metadata/query 三个独立模块，通过 httpapi.Services 注入同一个 Gin API，组合静态网页和 HTTP 生命周期；初始化失败原样返回错误。

## 约束与调用

只在 app 装配具体实现；模块通过自己的最小接口消费同一个仓库和客户端，query 只创建一次以共享并发预算。启动不覆盖已有连接；`Run(ctx context.Context) error` 收到取消信号时给予在途请求 5 秒结束时间，不在模块之间创建网络调用。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

app.New 装配 statefile/settings。StateDir 为空兼容旧调用者回落 DataDir/state；生产 config.Load 始终提供基于启动工作目录解析的绝对路径。

装配 ai.New(stateStore, repository, deepseek.New())；AI与SQL执行分别拥有并发预算。

app.New 在打开连接仓库前调用 connection.Migrate(cfg.LegacyDataDir,cfg.DataDir)，迁移冲突或校验失败直接阻止启动，不回退为新空连接列表。生产默认 DataDir=StateDir，连接、密钥与布局位于同一启动工作目录下的配置目录；显式 DataDir/StateDir 配置仍保留。

app 同时创建 mysql.Client 与 postgresql.Client，通过 database.New 注册，业务模块仍消费最小端口；只有装配层导入具体引擎。

workspace.New(stateStore) 与 settings 共用仓库，独立模块公开分片工作区API；普通分区不能绕过workspace-index引用边界。首次迁移在请求时进行，不阻塞服务装配或改动凭据。

MariaDB 单独注册 mariadb.Client；该实例组合 MySQL 协议驱动，类型保持 mariadb，关闭状态与其他引擎实例隔离。

装配打开原 statefile 目录，再处理连接迁移和仓库初始化，不添加启动强制写入探测。监听失败明确报告端口和旧 go run/其他进程占用的可能性；不停止其他进程、不修改配置目录或文件权限。

app 调用 webui.Register(router,cfg.WebDir)，用 Gin StaticFS/StaticFileFS 注册前端路由，NoRoute 只处理未知路径。`/api` 与 `/api/*` 的未知接口始终返回 JSON 404，不会落入静态目录。空 WebDir 按构建标签选择资源：embedded 使用编译进程序的 dist，普通开发构建读取前端 dist；显式 WebDir 覆盖默认资源。资源、目录与 HTTP 方法边界由 webui 管理。

Agent在同一app装配；agentDatabase直接组合现有连接/元数据/共享query实例，无内部HTTP。agentCredentials从statefile的ai分区逐次读取。Agent从空记录开始，不读取独立项目数据，详见[Agent](../../../docs/AGENT.md)。

Agent操作模式：POST /api/agent/chat 增加mode（readonly默认，write为完全访问模式，允许非删除数据及结构操作）。任何模式拒绝DELETE/DROP/TRUNCATE/REPLACE和DDL；删除仅提供命令及风险提示，不自动执行。刷新和往返工作台恢复上次确认的模式。支持单条INSERT/UPDATE/CREATE/ALTER/COMMENT及表达式和子查询；多语句、存储程序、动态SQL不执行，以防绕过删除限制；取消不保证回滚。查询回答提示生成真实二维JSON表格，前端校验后展示，支持导出当前已加载结果xlsx，截断明确提示。
