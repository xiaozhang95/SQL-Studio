# SQL Studio 接口列表

Swagger UI：开发时启动前后端后打开 `http://127.0.0.1:15173/swagger.html`；Go 从网页目录提供同源 `/swagger.html`。Electron 打包版由主进程分配本地服务端口。UI 资源随前端构建，不依赖 CDN。

Electron 的 `pnpm build` 将前端网页与 Go 程序一起打包，运行时通过 SQLDESK_WEB_DIR 指定随包网页目录。Gin 在 `GET /` 和 `GET /agent` 提供同一份页面入口，由前端历史路由分别展示工作区和 AI 助手；`GET /swagger.html` 提供文档页面、`GET /assets/*` 提供构建静态资源（均支持 HEAD）。`/api` 命名空间保留给下方接口，未知 API 返回 JSON 404。静态目录不列文件，丢失资源和未知页面路径返回 404。独立开发运行未指定 SQLDESK_WEB_DIR 时，从后端工作目录读取 `../sql-studio-frontend/dist`。

[OpenAPI 3.0 契约](../sql-studio-backend/internal/httpapi/openapi.json) 是字段、请求、响应及状态码的完整说明，运行时从 `GET /api/openapi.json` 获取。修改接口同步契约和本文件；Go 测试校验三者路由一致。

## 路由

路径均相对于 `/api`。开发时经 Vite 同源代理访问 Go。

| 方法   | 路径                          | 说明                                        |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/health`                     | 服务健康（不测试数据库）                    |
| GET | `/workspace` | 读取 v2 工作区轻量索引 |
| PUT | `/workspace` | revision/index/drafts/results，CAS 增量内容提交 |
| GET | `/workspace/parts/{id}` | 按64位SHA256读取草稿或结果，不执行SQL |
| GET    | `/openapi.json`               | OpenAPI 文档                                |
| GET    | `/connections`                | 连接列表（无密码）                          |
| GET | `/connection-groups` | 共享分组列表，包含空分组及默认分组 |
| POST | `/connection-groups` | `{name}` 新建独立分组，返回 string[] |
| POST | `/connection-groups/rename` | `{name,newName}` 原子重命名及更新成员，返回 `{groups,connections}` |
| DELETE | `/connection-groups` | 删除分组，成员移入默认分组 |
| PATCH | `/connections/{id}/group` | `{group}` 移动连接，返回脱敏 Connection |
| POST   | `/connections`                | 新增或更新连接                              |
| DELETE | `/connections/{id}`           | 删除本地连接                                |
| POST   | `/connections/{id}/session`   | 打开/关闭连接或数据库，关闭等待底层连接释放 |
| POST   | `/connections/test`           | 测试表单连接，返回版本                      |
| GET    | `/connections/{id}/databases` | 数据库名称列表                              |
| GET    | `/connections/{id}/schemas` | 数据库内可访问的 schema（含空 schema） |
| GET    | `/connections/{id}/tables`    | 表和视图列表                                |
| GET    | `/connections/{id}/columns`   | 字段列表                                    |
| GET    | `/connections/{id}/indexes`   | 索引列表，含唯一性、类型及按顺序排列的字段  |
| GET    | `/connections/{id}/ddl`       | 对象建表语句                                |
| GET | `/connections/{id}/export-data` | `database`、`table` 必填，SSE 分批只读表数据 rows/done/error，支持取消 |
| POST   | `/connections/{id}/query`     | 执行一条 SQL                                |
| GET    | `/state/{section}`            | 读取配置分区                                |
| PUT    | `/state/{section}`            | 按修订号保存配置                            |
| POST   | `/ai/assist`                  | SQL 续写或优化                              |
| POST   | `/ai/models`                  | 获取服务商模型列表                          |
| DELETE | `/ai/config`                  | 清除 AI 配置并关闭续写                      |

## 公共约定

JSON 与 SSE 请求可发送 `Accept-Language: zh-CN` 或 `en-US`，支持语言范围与 q 权重，未提供或无法匹配时默认简体中文。响应以 Content-Language 标明所选语言，并设置 Vary: Accept-Language。应用错误、导出流错误、Agent 系统状态、停止与继续确认提示按请求语言返回；读取历史时只转换响应中的系统事件。SQL、字段与行数据、用户命名、模型回答及未知的数据库/系统原始错误保留原文，状态码、字段名和持久化格式不随语言变化。

`appearance` 分区的 data 为 `{theme, fontSize, language}`，theme 支持 system/light/dark，fontSize 支持 small/standard/large，language 支持 zh-CN/en-US。前端读取既有配置时，缺少 language 按 zh-CN 展示；主题、字号和语言通过同一次显式保存提交，成功后应用。状态接口保持原有版本化信封和修订冲突约定，存储说明见 [用户状态配置](USER_STATE.md)。

成功直接返回 JSON，错误为 `{"error":"原因"}`。输入/数据库/AI 上游错误 400，跨站或非本机 Host 403，连接不存在 404，配置修订冲突 409，并发超限 429，模块未装配 503。仅面向本机单用户，不提供开放 CORS。

请求必须为单个 JSON 对象，拒绝 null、未知顶层字段、多个 JSON 和超过 1 MiB 的普通请求。配置 PUT 的 HTTP 信封上限为 32 MiB + 1024 字节，data 对象最多 32 MiB。

## 请求与行为边界

- **连接**支持 `mysql`、`mariadb` 和 `postgresql`。`name`、`host`、`port`（1–65535）和 `username` 必填。`type` 省略或为空按 `mysql`，`group` 留空归入默认分组。PostgreSQL 连接配置的 `database` 是维护库，默认 `postgres`。更新传 `id`，密码留空保留原值，响应以 `hasPassword` 表示是否有密码。测试最长 7 秒，启用 TLS 时校验证书链和主机名。
- **分组**：名称去首尾空白，拒绝空名称、控制字符、重名；默认分组为固定回退项，不可重命名。空分组独立保存，连接表单输入新分组后保存也会登记。重命名更新全部成员。删除接收 `{name}`，将成员移回默认分组并返回 `{groups,connections}`。删除默认分组返回 400，写入失败保留原状态。移动只修改归属，不打开/关闭数据库会话、不修改凭据；不存在连接/原分组返回 404，不存在移动目标返回 400。
- **元数据**：按显式 id/database/table 取对象，最长 10 秒，不以当前前端页面推断目标。
- **索引**返回 `name`、`unique`、`type`、可选的 `primary` 及 `columns`。列项为 `{name,position,prefixLength,order}`，位置从 1 开始，顺序为 `A`、`D` 或空字符串。MySQL 和 MariaDB 的主键索引名为 `PRIMARY`，表达式字段的 `name` 为空。PostgreSQL 保留实际索引名，以 `primary` 标记主键，`name` 保存索引列定义（含表达式），`prefixLength` 为 `null`。无索引返回空数组。
- **查询**：`{"database":"","sql":"SELECT 1","limit":1000,"allowWrite":false}`。每次仅一条 SQL，默认只读；limit<=0 使用 1000，超过 5000 限制为 5000。约 8 MiB 字段内容、30 秒、4 并发。rows 为二维数组，整数/DECIMAL 使用文本，保留 NULL 和重复列名。truncated 表示截断。显式写入自动提交，失败或取消不等于回滚。单元格更新可传 `matchRows: true`，使 MySQL/MariaDB 的 UPDATE 将匹配行数作为 `affectedRows`。该选项默认关闭，PostgreSQL 使用原生计数。
- **配置**：分区名匹配 `^[a-z][a-z0-9-]{0,47}$`。GET 返回 `{schemaVersion:1,revision,updatedAt,data,extensions?}`，缺失时 revision=0、data=null。PUT 提交 `{revision,data:{...}}`；现存分区严格比较修订号，缺失文件允许按当前会话修订连续重建。损坏和未知版本拒绝覆盖。
- **AI 配置**：ai-models 分区使用 `{configurations:[{id,provider,model,modelName,apiKey}],activeId,completionEnabled?}`，最多 64 条。model 是实际调用 ID，modelName 为显示名称。相同供应商与模型 ID 不得重复。编辑空 Key 保留该行原值，完整列表一次 CAS 保存，空数组清空。仅支持列表格式。activeId 是 SQL 工具栏与 AI 助手共享的默认记录 ID，可从系统设置模型列表或 AI 助手切换。列表非空且 activeId 为空时，读取和调用使用首条可用记录，保存时写入该 ID。响应逐行清除 Key。DELETE 提交 `{revision}` 清空记录并关闭补全。
- **AI 调用**：assist 的 action 为 complete/optimize，分别使用 prefix/suffix 或 sql，可附 document、database、table、tables。SQL 三字段合计最多 48000 字节，document 最多 64000 字节，最多 12 表/每表 128 字段。提供 connectionId 时后端解析名称与引擎，忽略客户端伪造的 connection。续写 12 秒，优化 30 秒，模型发现 10 秒，共享 4 并发。不执行生成 SQL，不发送数据库密码或查询结果。模型发现使用本次 Key，或在空 Key 时以 configId 精确指定记录，未知记录拒绝。发现结果须由用户选中并保存为记录。SQL 和 AI 助手调用当前默认记录。

会话控制 POST `/connections/{id}/session` 接收 `{open:boolean,database?:string}`；省略 database 为整个连接，指定库名只关闭该库。关闭取消在途请求并等待本服务驱动连接释放，超时或失败不返回成功；关闭后请求拒绝，显式打开会测试真实连通性。不会删除保存的连接，也不会终止其他客户端会话。

普通状态接口拒绝 `connections`、`workspace-index` 和 `ai` 分区。连接及工作区通过各自的专用 API 读写，`master.key` 不通过接口返回。

PostgreSQL 表名使用完整的 `"schema"."table"`。DDL 提供目录结构参考，分区子表和外部表返回错误。查询和 AI 辅助请求可携带 `schema`，PostgreSQL 查询验证 USAGE 后设置本次连接的搜索路径。MySQL 和 MariaDB 查询使用数据库范围，拒绝非空的独立 `schema`。

MySQL、MariaDB 和 PostgreSQL 工作台手动执行及查询结果刷新均传 `allowWrite: true`，支持 DDL/DML。PostgreSQL 和 MariaDB 支持各自方言的 `RETURNING`，返回的列与行作为结果集。多语句逐条独立请求，不能跨请求使用 BEGIN/COMMIT 或 SET 维护会话。

MySQL 和 MariaDB 默认只读请求仅接受查询类语句及 USE，并在数据库访问前拒绝 DDL、事务控制、SET、CALL 等非查询语句和可执行版本注释（含 MariaDB 的 `/*M!`），避免 DDL 隐式提交绕过只读事务。字符串内的注释文本、普通注释及优化器提示保持可查询。显式 allowWrite=true 的对象/数据操作不受此只读入口限制。

## 流式转储

`GET /connections/{id}/export-data` 必须携带 database/table。响应为 text/event-stream，data JSON 的 type 为 rows（result 为普通 QueryResult，无截断）、done 或 error（error 字符串）。只有 done 表示成功；约每10秒发送注释心跳。断开取消、后端独立2并发/30分钟限制、单行8MiB限制，不改变普通查询1000/5000行限制。客户端分批写入文件，失败/取消不提交文件。数据库/Schema 导出顺序读取各表，不提供全库同一时间快照，不包含例程、触发器、事件、授权及外部类型/函数依赖。

## 工作区

`GET /workspace` 返回 `{revision,index}`。`index.version` 为 2，`tabs` 保存页面元数据及 `draftRef`、`resultRef`，索引同时保存活动页、布局和执行状态。缺少当前索引时返回空工作区。`GET /workspace/parts/{id}` 按 64 位 SHA-256 十六进制散列读取 `{sql}` 草稿或 `RunState` 结果，无内容引用为空字符串。缺失返回 404，校验失败返回 400，成功响应使用 `Cache-Control: no-store`。

PUT /workspace 接受 {revision,index,drafts:{pageId:sql},results:{pageId:RunState|null}}。索引中原ref必须匹配当前版本，新增页须提供草稿；服务生成新ref，全部内容写入后才严格CAS提交索引。返回新revision/index，冲突409，失败保留旧索引。每份内容32MiB，请求96MiB+1MiB；布局与未变化内容不传全文。删除标签时从 `index` 移除对应记录。模块不可用返回 503。

只读写当前索引和分片。后台最多每 5 秒安排一次回收，清理超过 24 小时的未引用分片，并将未引用内容控制在 128 MiB 回收目标内。已引用内容保留。

## 数据库 Agent

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/agent/sessions` | 会话索引 |
| POST | `/agent/sessions` | 创建会话，{ensure:true}仅在空列表原子创建默认会话 |
| GET | `/agent/sessions/{id}` | 分页读取会话事件 |
| DELETE | `/agent/sessions/{id}` | 删除空闲会话 |
| PATCH | `/agent/sessions/{id}` | {title}重命名空闲会话，返回更新后的索引信息 |
| POST | `/agent/chat` | SSE思考、工具与回答 |
| POST | `/agent/write-confirmation` | {approvalId,allow} 确认或取消当前待执行写入 |
| POST | `/agent/continue-confirmation` | {approvalId,allow} 确认或停止当前继续请求，确认令牌按用途隔离且只用一次 |
| GET | `/agent/workspace` | 恢复Agent布局 |
| PUT | `/agent/workspace` | CAS保存Agent布局 |
| GET | `/agent/settings` | 读取共享DeepSeek脱敏配置 |
| PUT | `/agent/settings` | 用 `{configId}` 选择已添加模型 |
| DELETE | `/agent/settings` | 清除共享DeepSeek配置 |

同源 `/api/agent` 路由复用单进程服务；Chat 请求 `{sessionId,message,mode?}`，SSE data为JSON，最后done表示结束，error不代表成功。会话布局PUT要求{revision,state}，冲突409；设置与 SQL 续写共用新 ai-models 列表，Agent 设置 PUT 只接收 `{configId}` 切换已添加的模型记录。只读查询使用 `allowWrite: false`、上限 100 行，与 SQL 窗口共享 4 路数据库查询预算。Agent 自身有 2 路执行名额，接收提问前检查，等待确认时释放，获准后重新获取。

消息与草稿按 UTF-8 字节计算，单条最多 256 KiB。超过 64 KiB 的输入、超过 32 KiB 的单次工具结果和可压缩的上下文会发送 `continue_confirmation`，携带 `approvalId`、`kind` 和 `detail`。当前后端发出 `input`、`result` 或 `context`。同意后仅继续对应步骤，拒绝以 `stopped` 和 `done` 结束。列库时连接读取失败返回含 `warning` 和 `connectionId` 的 `tool_result`，同批其他工具继续走各自的流程。其他工具失败返回含 `warning` 的 `tool_result`，跳过同批后续工具，并把警告与已取得的结果交回模型。模型可在已确认范围内重新规划一次只读操作。写入失败或恢复阶段再次失败时，仅请求模型总结。会话处理错误通过 `error` 和 `done` 结束。

Agent数据库连接与工作台会话状态独立，只复用已保存的连接配置和进程查询并发预算。每次数据库操作结束（含失败、取消）即释放物理连接；不改变工作台打开/关闭状态，也不要求先在工作台打开连接。Agent会话保存目标，不保留物理连接，等待模型回复和用户写入确认期间不占用连接。

会话详情默认返回 `events`、`busy`、`revision`、`eventVersion` 及可选的 `nextOffset`。后续请求携带 `offset`、`revision`、`eventVersion`，版本变化返回 409。每页最多 256 个事件、约 256 KiB，较大的单条事件独占一页。当前 v2 会话按内容散列保存消息和事件，每个分片上限 32 MiB。

会话重命名去除首尾空白，限1–80字符且不含控制字符；手动命名持久保存，不再用首条消息覆盖。首次空历史及删除最后一条后，前端调用ensure创建并选中默认“新建会话”，不执行模型或数据库工具。

Agent操作模式：POST /api/agent/chat 的 mode（readonly默认，write为完全访问模式，允许非删除数据及结构操作）。任何模式拒绝DELETE/DROP/TRUNCATE/REPLACE及删除性DDL；删除仅提供命令及风险提示，不自动执行。刷新和往返工作台恢复上次确认的模式。支持单条INSERT/UPDATE/CREATE/ALTER/COMMENT及表达式和子查询；多语句、存储程序、动态SQL不执行，以防绕过删除限制；取消不保证回滚。查询回答提示生成真实二维JSON表格，前端校验后展示，支持导出当前已加载结果xlsx，截断明确提示。
