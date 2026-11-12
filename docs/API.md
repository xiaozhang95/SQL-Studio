# SQL Studio 接口列表

Swagger UI：启动前后端后打开 `http://127.0.0.1:15173/swagger.html`；构建版由 Go 提供 `http://127.0.0.1:18080/swagger.html`。UI 资源随前端构建，不依赖 CDN。

仓库根目录 `build.ps1` 将前端 dist 内嵌进 Go 可执行文件。打包版 Gin 在 `GET /` 提供工作台、`GET /swagger.html` 提供文档页面、`GET /assets/*` 提供构建静态资源（均支持 HEAD），不依赖外部 dist；`/api` 命名空间保留给下方接口，未知 API 返回 JSON 404。静态目录不列文件，丢失资源返回 404；SQLDESK_WEB_DIR 可显式覆盖内嵌网页。

[OpenAPI 3.0 契约](../sql-studio-backend/internal/httpapi/openapi.json) 是字段、请求、响应及状态码的完整说明，运行时从 `GET /api/openapi.json` 获取。修改接口同步契约和本文件；Go 测试校验三者路由一致。

## 路由

路径均相对于 `/api`。开发时经 Vite 同源代理访问 Go。

| 方法   | 路径                          | 说明                                        |
| ------ | ----------------------------- | ------------------------------------------- |
| GET    | `/health`                     | 服务健康（不测试数据库）                    |
| GET | `/workspace` | 轻量索引，兼容后端迁移旧工作区 |
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

成功直接返回 JSON，错误为 `{"error":"原因"}`。输入/数据库/AI 上游错误 400，跨站或非本机 Host 403，连接不存在 404，配置修订冲突 409，并发超限 429，模块未装配 503。仅面向本机单用户，不提供开放 CORS。

请求必须为单个 JSON 对象，拒绝 null、未知顶层字段、多个 JSON 和超过 1 MiB 的普通请求。配置 PUT 的 HTTP 信封上限为 32 MiB + 1024 字节，data 对象最多 32 MiB。

## 请求与行为边界

- **连接**：name、host、port（1–65535）、username 必填。type 省略或空字符串按 mysql；group 留空归入默认分组。更新传 id；password 留空保留旧密码，响应不含 password，用 hasPassword 表示。测试最长 7 秒；tls=true 校验证书链和主机名。
- **分组**：名称去首尾空白，拒绝空名称、控制字符、重名；默认分组为固定回退项，不可重命名。空分组独立保存，连接表单输入新分组后保存也会登记。重命名更新全部成员，移动只修改归属，不打开/关闭数据库会话、不修改凭据；不存在连接/原分组返回 404，不存在移动目标返回 400。
- **元数据**：按显式 id/database/table 取对象，最长 10 秒，不以当前前端页面推断目标。
- **索引**：GET `/connections/{id}/indexes?database=库名&table=表名` 返回 `{name,unique,type,columns:[{name,position,prefixLength,order}] }[]`。MySQL 主键名称为 PRIMARY，PostgreSQL 保留实际索引名，position 从 1 开始，prefixLength 可为 null，order 为 A（升序）、D（降序）或空字符串。表达式索引的字段名为空，仅标记为表达式，不返回表达式文本；无索引返回空数组。
- **查询**：`{"database":"","sql":"SELECT 1","limit":1000,"allowWrite":false}`。每次仅一条 SQL，默认只读；limit<=0 使用 1000，超过 5000 限制为 5000。约 8 MiB 字段内容、30 秒、4 并发。rows 为二维数组，整数/DECIMAL 使用文本，保留 NULL 和重复列名。truncated 表示截断。显式写入自动提交，失败或取消不等于回滚。
- **配置**：分区名匹配 `^[a-z][a-z0-9-]{0,47}$`。GET 返回 `{schemaVersion:1,revision,updatedAt,data,extensions?}`，缺失时 revision=0、data=null。PUT 提交 `{revision,data:{...}}`；现存分区严格比较修订号，缺失文件允许按当前会话修订连续重建。损坏和未知版本拒绝覆盖。
- **AI 配置**：ai-models 分区仅使用 `{configurations:[{id,provider,model,modelName,apiKey}],activeId,completionEnabled?}` 新格式，最多64条。model 是实际调用 ID，modelName 为显示名称；同供应商可添加不同模型，相同供应商与模型 ID 不得重复。编辑空 Key 仅保留该行原值，完整列表一次 CAS 保存，空数组清空。旧单条数据和旧顶层 provider/model/apiKey 请求不受支持，不做迁移。设置列表只管理记录；activeId 仅由 SQL 工具栏或 Agent 输入区的使用入口选择，空值不可调用且不自动选首项。响应逐行清除 Key。DELETE 提交 `{revision}` 清空记录并关闭补全。
- **AI 调用**：assist 的 action 为 complete/optimize，分别使用 prefix/suffix 或 sql，可附 document、database、table、tables。SQL 三字段合计最多 48000 字节，document 最多 64000 字节，最多 12 表/每表 128 字段。提供 connectionId 时后端解析名称与引擎，忽略客户端伪造的 connection。续写 12 秒，优化 30 秒，模型发现 10 秒，共享 4 并发；不执行生成 SQL，不发送数据库密码或查询结果。模型发现使用本次 Key，或在空 Key 时必须以 configId 精确指定记录；未知记录拒绝，不复用当前项或其他行的 Key。发现结果不自动选择模型，SQL/Agent 只调用明确选择的模型 ID，Agent 菜单只列出已添加模型。

会话控制 POST `/connections/{id}/session` 接收 `{open:boolean,database?:string}`；省略 database 为整个连接，指定库名只关闭该库。关闭取消在途请求并等待本服务驱动连接释放，超时或失败不返回成功；关闭后请求拒绝，显式打开会测试真实连通性。不会删除保存的连接，也不会终止其他客户端会话。

connections 是状态分区保留名称，GET/PUT /state/connections 均返回 400；同目录连接配置仅由专用连接 API 访问，master.key 不通过接口返回。

连接 type 新增 postgresql，database? 为 PostgreSQL 维护库（默认 postgres），不是查询请求的 database 当前库。PostgreSQL 表名为完整双引号 schema/table 对；索引保留实际名称及表达式文本，前缀长度为 null。DDL 为目录结构参考，非完整备份；分区子表和外部表返回明确错误。

索引响应新增可选 primary:boolean 标记 PostgreSQL 主键，旧 MySQL 响应不要求新增字段。

QueryRequest/AIRequest 新增可选 schema:string。PostgreSQL 请求指定 schema 时验证 USAGE 并在本次独占连接设置搜索路径，省略 allowWrite 的请求仍由只读事务保护；MySQL 查询拒绝非空独立 schema。

MySQL/PostgreSQL SQL 窗口手动执行及结果刷新均显式设置 allowWrite=true，支持 DDL/DML；PostgreSQL 支持 RETURNING；API 省略该字段仍默认只读。多语句逐条独立请求，不能跨请求使用 BEGIN/COMMIT 或 SET 维护会话。

MySQL 默认只读请求仅接受查询类语句及 USE，并在数据库访问前拒绝 DDL、事务控制、SET、CALL 等非查询语句和可执行版本注释，避免 DDL 隐式提交绕过只读事务。字符串内的注释文本、普通注释及优化器提示保持可查询。显式 allowWrite=true 的对象/数据操作不受此只读入口限制。

流式导出 `GET /connections/{id}/export-data` 必须携带 database/table。响应为 text/event-stream，data JSON 的 type 为 rows（result 为普通 QueryResult，无截断）、done 或 error（error 字符串）。只有 done 表示成功；约每10秒发送注释心跳。断开取消、后端独立2并发/30分钟限制、单行8MiB限制，不改变普通查询1000/5000行限制。客户端分批写入文件，失败/取消不提交文件。数据库/Schema 导出顺序读取各表，不提供全库同一时间快照，不包含例程、触发器、事件、授权及外部类型/函数依赖。

工作区v2：GET /workspace 返回 {revision,index}；index.version=2，tabs是原页面元数据加 draftRef/resultRef（无sql），其他布局字段同旧工作区，但没有runs。GET /workspace/parts/{id} 按SHA256读取 {sql:string} 草稿或RunState结果。无内容ref为空字符串；缺失404/校验失败400，响应no-store，不执行SQL。首次读取在后端迁移旧文件，原 workspace.json 保留。

PUT /workspace 接受 {revision,index,drafts:{pageId:sql},results:{pageId:RunState|null}}。索引中原ref必须匹配当前版本，新增页须提供草稿；服务生成新ref，全部内容写入后才严格CAS提交索引。返回新revision/index，冲突409，失败保留旧索引。每份内容32MiB，请求96MiB+1MiB；布局与未变化内容不传全文。删除标签从index移除即可，旧孤立内容超过24小时或超过128MiB回收预算时清理，当前引用保留。不可用服务503，不回落整份保存或空草稿覆盖。

已迁移后旧格式 workspace 分区写入返回409，要求旧客户端刷新；不允许旧格式覆盖或与新索引分叉。回收最多每5秒检查一次，128MiB为孤立内容回收目标（不包括当前引用），不是所有用户结果的总容量限制。

连接 type 支持 mysql、mariadb 和 postgresql。MariaDB 保留独立类型，使用数据库范围，不接受独立 schema；默认只读同样拒绝 /*M! 可执行注释。显式写入的 INSERT/DELETE/REPLACE RETURNING 返回列与行，isQuery 为 true。

DELETE `/connection-groups` 请求 `{name:string}`，返回 `{groups:string[],connections:Connection[]}`。原子移除自定义分组并把所有成员移到默认分组；不删除连接或改变密码/会话。默认分组 400，不存在 404，写入失败不发布内存变化。

## 数据库 Agent

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/agent/sessions` | 会话索引 |
| POST | `/agent/sessions` | 创建会话，{ensure:true}仅在空列表原子创建默认会话 |
| GET | `/agent/sessions/{id}` | 恢复事件 |
| DELETE | `/agent/sessions/{id}` | 删除空闲会话 |
| PATCH | `/agent/sessions/{id}` | {title}重命名空闲会话，返回更新后的索引信息 |
| POST | `/agent/chat` | SSE思考、工具与回答 |
| POST | `/agent/write-confirmation` | {approvalId,allow} 确认或取消当前待执行写入 |
| POST | `/agent/continue-confirmation` | {approvalId,allow} 确认或停止当前继续请求，确认令牌按用途隔离且只用一次 |
| GET | `/agent/workspace` | 恢复Agent布局 |
| PUT | `/agent/workspace` | CAS保存Agent布局 |
| GET | `/agent/settings` | 读取共享DeepSeek脱敏配置 |
| PUT | `/agent/settings` | 更新共享Key与模型 |
| DELETE | `/agent/settings` | 清除共享DeepSeek配置 |

同源 `/api/agent` 路由复用单进程服务；Chat 请求 {sessionId,message}，SSE data为JSON，最后done表示结束，error不代表成功。会话布局PUT要求{revision,state}，冲突409；设置与 SQL 续写共用新 ai-models 列表，Agent 设置 PUT 只接收 `{configId}` 切换已添加的模型记录。查询固定allowWrite:false、100行，与SQL窗口共享并发预算。

消息与草稿按 UTF-8 字节计算，单条最多 256 KiB。超过 64 KiB 的输入、超过 32 KiB 的单次工具结果和可压缩的上下文会发送 `continue_confirmation`，携带 `approvalId`、`kind` 和 `detail`。当前后端发出 `input`、`result` 或 `context`。同意后仅继续对应步骤，拒绝以 `stopped` 和 `done` 结束。列库时连接读取失败返回含 `warning` 和 `connectionId` 的 `tool_result`，同批其他工具继续走各自的流程。其他工具失败返回含 `warning` 的 `tool_result`，跳过同批后续工具，并把警告与已取得的结果交回模型。模型可在已确认范围内重新规划一次只读操作。写入失败或恢复阶段再次失败时，仅请求模型总结。会话处理错误通过 `error` 和 `done` 结束。

Agent数据库连接与工作台会话状态独立，只复用已保存的连接配置和进程查询并发预算。每次数据库操作结束（含失败、取消）即释放物理连接；不改变工作台打开/关闭状态，也不要求先在工作台打开连接。Agent会话保存目标，不保留物理连接，等待模型回复和用户写入确认期间不占用连接。

会话重命名去除首尾空白，限1–80字符且不含控制字符；手动命名持久保存，不再用首条消息覆盖。首次空历史及删除最后一条后，前端调用ensure创建并选中默认“新建会话”，不执行模型或数据库工具。

Agent操作模式：POST /api/agent/chat 增加mode（readonly默认，write为完全访问模式，允许非删除数据及结构操作）。任何模式拒绝DELETE/DROP/TRUNCATE/REPLACE及删除性DDL；删除仅提供命令及风险提示，不自动执行。刷新和往返工作台恢复上次确认的模式。支持单条INSERT/UPDATE/CREATE/ALTER/COMMENT及表达式和子查询；多语句、存储程序、动态SQL不执行，以防绕过删除限制；取消不保证回滚。查询回答提示生成真实二维JSON表格，前端校验后展示，支持导出当前已加载结果xlsx，截断明确提示。

## 2026-11-05 审查修复补充

- GET /api/agent/sessions/:id 默认分页返回 events、busy、revision、eventVersion 和可选 nextOffset；后续带 offset/revision/eventVersion，版本变化返回409。每页最多256事件、约256KiB，单条较大事件独占一页，不截断内容。
- 会话记录 schema v2 使用轻量版本文件和内容寻址的 messages/events 分片；兼容旧 v1，成功保存后迁移，单分片仍限32MiB，会话总量不再受单个32MiB文件限制。
- Agent 两路执行预算在接收提问前检查，等待确认释放名额，用户同意后重新获取；与工作台共享的数据库查询预算仍为4路。超时为可读 error，用户取消为 stopped，实时及恢复使用同一映射。
- 查询请求新增可选 matchRows（默认false），单元格 UPDATE 开启时 MySQL/MariaDB 使用匹配行数作为 affectedRows；匹配但值未变化返回1，旧值不匹配返回0。普通 SQL、插入、删除保持原有计数，PostgreSQL原有UPDATE计数不变。该字段不放宽只读、单语句或行数限制。
