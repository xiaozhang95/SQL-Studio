# 后端架构与维护规范

## 目录与责任

```text
sql-server/
├─ cmd/sql-studio/main.go
├─ internal/
│  ├─ app/           # 组合根与 HTTP 服务生命周期
│  ├─ config/        # 启动参数及路径解析
│  ├─ httpapi/       # Gin 路由、请求解码、响应编码、同源中间件
│  ├─ service/       # 业务流程、校验、查询策略、基础设施接口
│  ├─ model/         # 共享业务数据契约
│  ├─ mysql/         # MySQL 连接、结构读取、SQL 执行
│  ├─ postgres/      # PostgreSQL / PolarDB PostgreSQL、Oracle 兼容版协议
│  └─ connection/    # 连接仓库、AES-GCM 与原子落盘
├─ tests/
│  ├─ architecture/  # 依赖方向约束
│  └─ integration/   # 独立临时库的真实 MySQL / PostgreSQL 回归
├─ data/             # 沿用现有数据与密钥
```

| 层 | 主要文件 | 允许的职责 |
| --- | --- | --- |
| 启动入口 | `cmd/sql-studio/main.go` | 加载配置、创建 App、监听退出信号 |
| 应用装配 | `internal/app/app.go` | 创建具体仓库和驱动、注入 service、组合 API/静态网页、启动和关闭服务 |
| 配置 | `internal/config/config.go` | 统一读取环境变量、解析绝对路径、校验首次连接端口 |
| HTTP | `internal/httpapi/router.go` | 注册 Gin 路由和中间件；handler 使用 gin.Context |
| HTTP | `connection.go` / `metadata.go` / `query.go` | 解码 HTTP 参数、调用业务服务、返回数据 |
| HTTP | `response.go` / `middleware.go` | 统一 JSON、错误状态、请求体大小、本机和同源保护 |
| 业务 | `internal/service/service.go` | 声明所需仓库/数据库接口和业务策略 |
| 业务 | `database_registry.go` | 根据连接类型分派到已注入的协议实现 |
| 业务 | `connection.go` | 连接字段校验、密码留空时复用旧凭据进行测试 |
| 业务 | `metadata.go` | 获取连接凭据，限制元数据操作最长 10 秒 |
| 业务 | `query.go` | 空 SQL 校验、默认/最大行数、并发上限、30 秒期限 |
| 契约 | `internal/model/*.go` | Connection、Table、Column、QueryRequest、QueryResult 等跨层数据 |
| MySQL | `internal/mysql/connection.go` | 驱动参数、连接测试 |
| MySQL | `metadata.go` | SHOW DATABASES、information_schema、SHOW CREATE |
| MySQL | `query.go` | 只读事务、写入、游标关闭、结果大小限制、精度和二进制处理 |
| MySQL | `statement.go` | 标识符转义、SQL/CTE 类型识别（不承担权限校验） |
| PostgreSQL | `internal/postgres/connection.go` | pgx 配置、初始数据库、Schema search_path、TLS 与连接测试 |
| PostgreSQL | `metadata.go` / `query.go` | pg_catalog 结构读取、基础 DDL 重建、只读事务、文本协议精度与结果限制 |
| 存储 | `internal/connection/store.go` | 加密/解密、连接 CRUD、密码保留、临时文件替换 |

实现与单元测试同目录；跨包、真实服务和依赖约束测试放 `tests`。包内辅助函数保持私有，只有实际跨包使用的构造函数、方法和类型导出。

每个实际包维护 README.md 说明责任、调用关系和验证方式，internal 包同时通过 doc.go 提供中文包注释；索引见 [包目录](../sql-server/internal/README.md)。入口与测试目录也各自维护 README，不将 Go 源码强行改成前端式 index 文件。

## 依赖方向

```text
cmd/sql-studio → config + app
app           → config + connection + mysql + postgres + service + httpapi + Gin
httpapi       → service + model + Gin
service       → model + 自己声明的基础设施接口
connection    → model + 标准库
mysql         → model + MySQL 驱动
postgres      → model + pgx 驱动
config        → model + 标准库
```

只有 `app` 负责选择具体实现：`connection.Store` 满足 `service.ConnectionRepository`，`mysql.Client` 和 `postgres.Client` 满足 `service.Database`，通过 `DatabaseRegistry` 注入。业务层通过接口调用，不导入具体存储、数据库驱动或 HTTP。MySQL、MariaDB、PolarDB MySQL 共享 MySQL 协议；PostgreSQL、PolarDB PostgreSQL、PolarDB Oracle 兼容版共享 PostgreSQL 协议。

`tests/architecture/dependencies_test.go` 会解析非测试源码的 imports：禁止业务层/接口层直接访问 SQL 驱动和文件系统，禁止下层反向依赖 HTTP，禁止跨越项目包边界。新增分层包需要同时声明允许依赖，而不是任意导入。

`tests/architecture/documentation_test.go` 同时检查 internal 包的 README，避免新增包缺少维护说明。根目录 `node scripts/check-structure.mjs` 校验前后端模块归档和说明链接；后续修改遵循 [项目 skill](../.agents/skills/sql-studio/SKILL.md)。

## SQL 请求处理

1. `httpapi.query` 解码一条 `QueryRequest`，请求体最多 1 MiB，拒绝未知字段与多个 JSON 对象。
2. `service.Query` 校验非空 SQL，将返回上限规范到默认 1,000、最高 5,000，申请 4 个并发名额之一。
3. 业务层从连接仓库获取解密凭据，并创建最长 30 秒的子 context；调用者更短的期限/取消继续生效。
4. 注册表选择协议驱动并建立独立连接，默认使用数据库只读事务；显式写入模式允许自动提交。PostgreSQL 的 database 选择实际连接库，schema 设置安全转义后的 search_path；表元数据使用独立 Schema 字段。
5. 驱动层将结果限制为所选行数和约 8 MiB 字段内容，将精确整数/DECIMAL 保留为文本、二进制转为十六进制，并保留 NULL 和重复列名。
6. 驱动层关闭游标与连接，业务层归还并发名额，HTTP 层编码响应。

并发超限由业务层返回 `ErrBusy`，HTTP 映射为 429；不存在连接映射为 404，其他输入/数据库错误沿用 400 契约。接口保留既有路径与结果格式，增加连接类型、TLS、初始数据库及可选 Schema 字段。

## 配置、数据与生命周期

- 环境变量仅由 `config.Load` 读取，处理 `SQLDESK_DATA_DIR` / `SQLDESK_WEB_DIR` / `SQLDESK_MYSQL_*`。
- 从后端根目录执行 `go run ./cmd/sql-studio`；默认仍读取 `sql-server/data` 和 `../sql-web/dist`。
- `app.New` 只在没有连接时初始化默认连接，不用启动环境变量覆盖已有密码。
- 沿用 `connections.json`、AES-256-GCM 和 `master.key`；存量连接缺少 type 时按 MySQL 读取，无需重新填写密码。新增连接字段向后兼容。
- 配置校验失败时启动报错，避免错误端口被静默忽略；不在日志中输出密码。
- `app.Run` 收到取消时执行 HTTP Shutdown，最多等待 5 秒，超时再关闭剩余连接。Windows 脚本强制停止进程时不保证触发此宽限流程。

## 扩展要求

- 新接口放 `httpapi`，业务校验放 `service`，共享请求/结果放 `model`。
- 新的协议操作进入对应 `mysql` / `postgres` 包；新增数据库实现满足 `Database`，在 `app` 注入注册表。新增存储实现满足 `ConnectionRepository`。
- 不在 handler 中拼 SQL、打开 MySQL、读写 JSON 配置、读取环境变量或保存加密密钥。
- 不让驱动层返回 HTTP 状态；状态映射统一留在 `httpapi/response.go`。
- 修改查询策略时更新业务层测试；修改 SQL 或类型转换时更新驱动/集成测试；修改密码存储时更新仓库测试。
- 修改行为时同步更新本说明、[API 文档](API.md) 和 [验证记录](VERIFICATION.md)。

## 统一检查

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-server
go test -count=1 ./...
go vet ./...
go build ./...

# 真实 MySQL 回归：仅写入自动生成的临时测试库并在结束时清理
$env:SQLDESK_MYSQL_PASSWORD = '00000000'
$env:SQLDESK_INTEGRATION = '1'
go test -count=1 ./...

# PostgreSQL 回归，连接参数按实际环境配置
$env:SQLDESK_PG_HOST = '127.0.0.1'
$env:SQLDESK_PG_PORT = '5432'
$env:SQLDESK_PG_USER = 'postgres'
$env:SQLDESK_PG_PASSWORD = '实际密码'
$env:SQLDESK_PG_INTEGRATION = '1'
go test -count=1 ./...
```

依次使用 gofmt -l .（输出应为空）、go test ./...、go vet ./... 和 go build ./...；集成验证后自行清除环境开关。构建运行由根目录 `pnpm build 后在 sql-server 执行 go run ./cmd/sql-studio` 完成，停止仍用 `Ctrl+C`。
