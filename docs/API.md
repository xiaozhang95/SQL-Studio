# SQL Studio 接口列表

Swagger UI：启动前后端后打开 `http://127.0.0.1:5173/swagger.html`；构建版由 Go 提供 `http://127.0.0.1:8080/swagger.html`。UI 资源随前端构建，不依赖 CDN。

[OpenAPI 3.0 契约](../sql-studio-backend/internal/httpapi/openapi.json) 是字段、请求、响应及状态码的完整说明，运行时从 `GET /api/openapi.json` 获取。修改接口同步契约和本文件；Go 测试校验三者路由一致。

## 路由

路径均相对于 `/api`，共 17 个操作。开发时经 Vite 同源代理访问 Go。

| 方法   | 路径                          | 说明                                       |
| ------ | ----------------------------- | ------------------------------------------ |
| GET    | `/health`                     | 服务健康（不测试数据库）                   |
| GET    | `/openapi.json`               | OpenAPI 文档                               |
| GET    | `/connections`                | 连接列表（无密码）                         |
| POST   | `/connections`                | 新增或更新连接                             |
| DELETE | `/connections/{id}`           | 删除本地连接                               |
| POST   | `/connections/test`           | 测试表单连接，返回版本                     |
| GET    | `/connections/{id}/databases` | 数据库名称列表                             |
| GET    | `/connections/{id}/tables`    | 表和视图列表                               |
| GET    | `/connections/{id}/columns`   | 字段列表                                   |
| GET    | `/connections/{id}/indexes`   | 索引列表，含唯一性、类型及按顺序排列的字段 |
| GET    | `/connections/{id}/ddl`       | 对象建表语句                               |
| POST   | `/connections/{id}/query`     | 执行一条 SQL                               |
| GET    | `/state/{section}`            | 读取配置分区                               |
| PUT    | `/state/{section}`            | 按修订号保存配置                           |
| POST   | `/ai/assist`                  | SQL 续写或优化                             |
| POST   | `/ai/models`                  | 获取服务商模型列表                         |
| DELETE | `/ai/config`                  | 清除 AI 配置并关闭续写                     |

## 公共约定

成功直接返回 JSON，错误为 `{"error":"原因"}`。输入/数据库/AI 上游错误 400，跨站或非本机 Host 403，连接不存在 404，配置修订冲突 409，并发超限 429，模块未装配 503。仅面向本机单用户，不提供开放 CORS。

请求必须为单个 JSON 对象，拒绝 null、未知顶层字段、多个 JSON 和超过 1 MiB 的普通请求。配置 PUT 的 HTTP 信封上限为 32 MiB + 1024 字节，data 对象最多 32 MiB。

## 请求与行为边界

- **连接**：name、host、port（1–65535）、username 必填。type 省略或空字符串按 mysql；group 留空归入默认分组。更新传 id；password 留空保留旧密码，响应不含 password，用 hasPassword 表示。测试最长 7 秒；tls=true 校验证书链和主机名。
- **元数据**：按显式 id/database/table 取对象，最长 10 秒，不以当前前端页面推断目标。
- **索引**：GET `/connections/{id}/indexes?database=库名&table=表名` 返回 `{name,unique,type,columns:[{name,position,prefixLength,order}] }[]`。主键名称为 PRIMARY，position 从 1 开始，prefixLength 可为 null，order 为 A（升序）、D（降序）或空字符串。表达式索引的字段名为空，仅标记为表达式，不返回表达式文本；无索引返回空数组。
- **查询**：`{"database":"","sql":"SELECT 1","limit":1000,"allowWrite":false}`。每次仅一条 SQL，默认只读；limit<=0 使用 1000，超过 5000 限制为 5000。约 8 MiB 字段内容、30 秒、4 并发。rows 为二维数组，整数/DECIMAL 使用文本，保留 NULL 和重复列名。truncated 表示截断。显式写入自动提交，失败或取消不等于回滚。
- **配置**：分区名匹配 `^[a-z][a-z0-9-]{0,47}$`。GET 返回 `{schemaVersion:1,revision,updatedAt,data,extensions?}`，缺失时 revision=0、data=null。PUT 提交 `{revision,data:{...}}`；现存分区严格比较修订号，缺失文件允许按当前会话修订连续重建。损坏和未知版本拒绝覆盖。
- **AI 配置**：使用 ai 分区，data 为 `{provider:"deepseek",apiKey,model?,completionEnabled?}`。首次填写 Key，后续留空保留；响应仅返回脱敏配置，未配置时 configured 可能省略。移除提交 `{revision}`，保留修订号并关闭续写。
- **AI 调用**：assist 的 action 为 complete/optimize，分别使用 prefix/suffix 或 sql，可附 document、database、table、tables。SQL 三字段合计最多 48000 字节，document 最多 64000 字节，最多 12 表/每表 128 字段。提供 connectionId 时后端解析名称与引擎，忽略客户端伪造的 connection。续写 12 秒，优化 30 秒，模型发现 10 秒，共享 4 并发；不执行生成 SQL，不发送数据库密码或查询结果。模型发现可使用本次 Key 或已保存 Key。
