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
  "type": "mysql",
  "tls": false,
  "host": "127.0.0.1",
  "port": 3306,
  "username": "root",
  "password": "填写实际密码"
}
```

`type` 只接受 `mysql`，省略按 MySQL 兼容旧配置。已有非 MySQL 连接不删除但不再作为可用连接返回。`tls: true` 启用证书及主机名校验，不接受跳过证书验证。健康响应包含 `framework: "gin"`，所有 API 通过 Gin 路由。

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
