# Gin HTTP 接口

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

注册路由、解析参数、限制 JSON、同源及本机保护，并统一错误响应。

## 约束与调用

`New(services Services) *gin.Engine` 接收 app 装配的 Connections、Metadata、Queries、Settings、AI 模块，只调用公开方法，不直接开数据库或读文件，也不在每次请求时重建模块；路径/字段契约见 [API 列表](../../../docs/API.md) 和 [OpenAPI](openapi.json)。连接、结构、SQL 路由分别使用所属模块；`query.ErrBusy` 映射为 429。

连接新增/更新和列表透传可选 group 字段。TestConnectionGroupRoundTrip 使用临时目录验证 API 保存、重启读取、更换及清空分组，同时检查编辑空密码保留原凭据。

缺少或空 group 统一为“默认分组”；TestLegacyConnectionsBelongToDefaultGroup 验证旧配置归类、密码脱敏以及读取不改写文件。

module_routes_test.go 使用真实业务模块和测试数据库接口验证双连接同名对象的路由归属、字段解码、精确数值透传、未知字段/多 JSON/超限请求拒绝、缺失连接 404 及并发超限 429，不访问真实数据库。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

GET/PUT /api/state/:section 调用 settings。PUT 限32MiB，CAS冲突409，沿用本机同源保护。

POST /api/ai/assist 调用 AI 模块；严格解码和1MiB限制，AI并发超限429，未装配503。继承HTTP请求取消。

POST /api/ai/models 接收provider和可选apiKey，通过AI模块获取真实可用模型；缺省Key从后端读取，响应仅id/name。

DELETE /api/ai/config 接收{revision}移除AI配置，冲突409，不改其他配置分区。

GET /api/openapi.json 返回编译内嵌的 OpenAPI 3.0 契约，不依赖运行目录。Swagger 页面位于前端独立入口 swagger.html，构建后由 Go 提供。openapi_test.go 使用真实 Gin 注册表核对契约与 Markdown 列表，防止漏记路由。

JSON 解码统一使用 decodeLimit：普通请求 1 MiB，配置写入 32 MiB + 1024 字节信封。要求对象起始符，拒绝 null/数组/多 JSON/未知顶层字段，避免零值输入触发修改；保留流式解码和业务层 data 大小校验。

配置 PUT 与 AI 移除必须显式提供非 null 的 revision，首次写入可为 0；缺失字段不能以零值替代并触发写入。
