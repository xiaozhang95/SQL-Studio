# SQL Studio API

默认根地址：`http://127.0.0.1:8080/api`。开发时前端请求同源 `/api`，Vite 转发到 Go。JSON 成功响应直接返回数据，失败为非 2xx 状态及 `{ "error": "原因" }`。连接不存在返回 404，查询并发超限返回 429，输入/数据库错误返回 400。请求体上限 1 MiB。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 服务健康（不代表数据库已连接） |
| GET | `/connections` | 连接列表，不含密码，有 `hasPassword` 标记 |
| POST | `/connections` | 新增/更新；更新时携带 `id`；空密码保留已有密码 |
| DELETE | `/connections/{id}` | 删除本地保存连接 |
| POST | `/connections/test` | 测试表单中的连接，返回数据库 version |
| GET | `/connections/{id}/databases` | 可访问库名列表 |
| GET | `/connections/{id}/tables?database=库名` | 表/视图 name、type、comment |
| GET | `/connections/{id}/columns?database=库名&table=表名` | 字段 name、type、nullable、key、default、extra、comment |
| GET | `/connections/{id}/ddl?database=库名&table=表名` | `{ "ddl": "CREATE ..." }` |
| POST | `/connections/{id}/query` | 执行一条 SQL |

新增/测试请求：

```json
{
  "name": "本地 MySQL",
  "group": "开发环境",
  "type": "mysql",
  "tls": false,
  "host": "127.0.0.1",
  "port": 3306,
  "username": "root",
  "password": "填写实际密码"
}
```

`type` 只接受 `mysql`，省略按 MySQL 兼容旧配置。已有非 MySQL 连接不删除但不再作为可用连接返回。`tls: true` 启用证书及主机名校验，不接受跳过证书验证。健康响应包含 `framework: "gin"`，所有 API 通过 Gin 路由。

`group` 为可选分组名，保存时去除首尾空白，与连接一同保存并在保存/列表响应中返回；省略、空字符串及旧连接缺少该字段时统一归入“默认分组”，更新时可用空字符串回到默认分组。已有自定义分组保留；列表读取不重写旧配置。分组不影响数据库访问范围或连接凭据。

执行请求（不传 database 时可以执行无库查询）：

```json
{
  "database": "information_schema",
  "sql": "SELECT CHARACTER_SET_NAME FROM CHARACTER_SETS LIMIT 10",
  "limit": 1000,
  "allowWrite": false
}
```

查询响应：

```json
{
  "columns": [{ "name": "id", "type": "BIGINT" }],
  "rows": [["9007199254740993"]],
  "rowCount": 1,
  "affectedRows": 0,
  "lastInsertId": "",
  "durationMs": 3,
  "truncated": false,
  "isQuery": true
}
```

结果使用二维数组而非按列名构造对象，因此同名列可同时保留。MySQL 整数与 DECIMAL 是字符串，浮点数保留 JSON number，日期时间以服务端文本展示。保留 JSON null，二进制转为十六进制字符串。

普通写入响应使用 `isQuery: false`、`affectedRows` 和字符串 `lastInsertId`；columns/rows 为空数组。MySQL 识别 WITH 后的主语句。仅执行单条 SQL，不提供多结果集。写入自动提交；`allowWrite` 默认 false 并使用只读事务。


超时为 30 秒，limit 默认 1,000，最高 5,000；达到结果行数或约 8 MiB 字段内容时 `truncated: true`。API 拒绝跨源请求；本地工具不提供开放 CORS。

前端库表右键管理现使用既有 `/connections/{id}/query`，仅在对象表单确认保存时显式传 `allowWrite:true`。普通 SQL 编辑器不传此值。对象表单的 SHOW COLLATION 等只读元数据可传 limit=5000，仍遵守并发、超时、字节和单语句限制。无新增 HTTP 路由。

GET /api/state/:section 返回 {schemaVersion:1,revision,updatedAt,data,extensions?}，缺失分区 revision=0,data=null。PUT 同路径提交 {revision,data}，data须对象、最多32MiB，返回更新信封；修订冲突409，损坏/未知版本拒绝覆盖。分区匹配 ^[a-z][a-z0-9-]{0,47}$。

### AI 配置

GET /api/state/ai 返回 data: {provider: "deepseek", configured: boolean}，尚未配置时 data 为 null。PUT /api/state/ai 接收 {revision, data: {provider: "deepseek", apiKey: string}}；空 Key 保留已保存值，首次必须填写。响应不含 apiKey，修订冲突返回 409。本接口只保存配置，不请求 DeepSeek。

### SQL AI

POST /api/ai/assist：{action:"complete"|"optimize", connectionId, database, tables:[{name,columns:string[]}], sql?, prefix?, suffix?}。complete 返回 {completion?}，optimize 返回 {sql,explanation?}；空续写允许返回 {}。输入SQL合计48KB、12表/每表128字段；续写12秒、优化30秒，4并发，超限429。Key仅后端读取，官方所选模型（旧配置默认Flash）的非思考JSON输出，不自动执行SQL。错误不包含上游响应正文和凭据。

### AI 模型与续写配置

AI配置分区增加model:string、completionEnabled:boolean；旧记录默认开启续写、空模型由DeepSeek客户端兼容默认Flash。PUT保存选择的官方模型ID，未传字段保留旧值；响应仍不含Key。POST /api/ai/models 接收{provider:"deepseek",apiKey?:string}，不传Key则使用已保存值；返回[{id,name}]，真实调用官方GET /models，10秒超时，满并发429。续写开关关闭时后端拒绝complete请求。

AI续写上下文增加document?:string（草稿开头最多16000字符/后端64KB限制，保留注释）、table?:string、tables[].comment。后端根据connectionId补充connection:{name,type}后发给模型，不包含连接凭据。prefix/suffix继续原样保留光标附近SQL和注释。

DELETE /api/ai/config 接收{revision:number}，清空DeepSeek Key/模型并关闭续写；返回脱敏配置和新修订号，旧修订冲突409。保留修订信息防止旧窗口恢复已移除Key，可重新填写Key配置。
