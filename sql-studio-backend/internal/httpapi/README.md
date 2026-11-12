# Gin HTTP 接口

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

注册路由、解析参数、限制 JSON、同源及本机保护，并统一错误响应。

## 约束与调用

`New(services Services) *gin.Engine` 接收 app 装配的 Connections、Metadata、Queries、Settings、AI 模块，只调用公开方法，不直接开数据库或读文件，也不在每次请求时重建模块；路径/字段契约见 [API 列表](../../../docs/API.md) 和 [OpenAPI](openapi.json)。连接、结构、SQL 路由分别使用所属模块；`query.ErrBusy` 映射为 429。

连接新增/更新和列表透传可选 group 字段。TestConnectionGroupRoundTrip 使用临时目录验证 API 保存、重启读取、更换及清空分组，同时检查编辑空密码保留原凭据。

新建连接的空分组输入初始化为当前默认分组，当前连接文件必须完整保存 type/group；列表读取不转换旧文件。

module_routes_test.go 使用真实业务模块和测试数据库接口验证双连接同名对象的路由归属、字段解码、精确数值透传、未知字段/多 JSON/超限请求拒绝、缺失连接 404 及并发超限 429，不访问真实数据库。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

GET/PUT /api/state/:section 调用 settings。PUT 限32MiB，CAS冲突409，沿用本机同源保护。

POST /api/ai/assist 调用 AI 模块；严格解码和1MiB限制，AI并发超限429，未装配503。继承HTTP请求取消。

POST /api/ai/models 接收 provider、可选 apiKey/configId，通过 AI 模块获取真实可用模型；空 Key 只复用指定记录的 Key，未知 ID 拒绝，响应仅 id/name。

DELETE /api/ai/config 接收{revision}移除AI配置，冲突409，不改其他配置分区。

GET /api/openapi.json 返回编译内嵌的 OpenAPI 3.0 契约，不依赖运行目录。Swagger 页面位于前端独立入口 swagger.html，构建后由 Go 提供。openapi_test.go 使用真实 Gin 注册表核对契约与 Markdown 列表，防止漏记路由。

JSON 解码统一使用 decodeLimit：普通请求 1 MiB，配置写入 32 MiB + 1024 字节信封。要求对象起始符，拒绝 null/数组/多 JSON/未知顶层字段，避免零值输入触发修改；保留流式解码和业务层 data 大小校验。

配置 PUT 与 AI 移除必须显式提供非 null 的 revision，首次写入可为 0；缺失字段不能以零值替代并触发写入。

GET /api/connections/:id/indexes 接受 database/table，返回只读索引列表，继承元数据的范围、超时及取消；Swagger 和本地 API 列表同步维护。

POST /api/connections/:id/session 要求显式非 null 的 open 布尔值；database 省略为整个连接，显式 null、空字符串和非字符串均拒绝。关闭成功响应表示目标驱动资源已释放。session_test.go 检查输入、原始范围、超时与失败响应；Swagger 及本地列表同步维护。

新增 GET /connections/{id}/schemas?database=...，返回 schema 名称数组，仅解码/转发 metadata.Schemas。

GET /connections/:id/export-data?database=...&table=... 输出 SSE JSON 事件 rows(result:QueryResult)、done、error(error:string)，开始与每10秒注释心跳。只对该流动态续期写入 deadline，普通HTTP超时不变。断开连接取消模块请求，逐事件背压，无部分成功保证，只有 done 表示游标结束；无效范围400，其余运行错误通过 error事件报告。

GET/PUT /workspace 和 GET /workspace/parts/:id 调用独立workspace模块。GET只返回轻量索引，PUT要求显式revision并只提交变化的drafts/results，最多96MiB+1MiB信封，单份内容32MiB；冲突409。Part返回原始JSON并no-store，散列无效400、丢失404、损坏400。不在HTTP读写文件或执行SQL。

DELETE /connection-groups 接收 {name:string}，调用 connections.DeleteGroup 并返回 GroupState；沿用单 JSON、未知字段、同源限制及 400/404 错误映射。

/api/agent路由调用Agent、布局与共享settings公开方法；流式端点每10秒心跳并独立续期写截止时间，断开取消后等待最终保存完成。布局冲突409，普通请求32KiB，严格JSON/同源规则不变。

POST /agent/sessions支持可选ensure=true，仅在空列表创建默认会话；PATCH /agent/sessions/:id接收{title}并返回索引信息，严格JSON、同源和32KiB限制沿用现有Agent路由。


写入逐次确认：execute_write通过write_confirmation SSE事件暂停，携带approvalId/connection/database/objects/sql。POST /api/agent/write-confirmation提交allow，确认ID不可重复使用；未确认、取消、超时、断开不执行，取消结束本轮。服务端生成明细并绑定本次目标/SQL，不接收前端替换SQL。确认独立等待最多5分钟，等待期间暂停本轮执行计时；恢复历史只展示原记录。继续确认通过 `continue_confirmation` 和 `POST /api/agent/continue-confirmation` 处理，拒绝产生 `stopped` 事件。模式提示不替代逐次确认。
