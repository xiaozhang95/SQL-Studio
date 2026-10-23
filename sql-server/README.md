# SQL Studio 后端

[包索引](internal/README.md) · [项目规范 skill](../.agents/skills/sql-studio/SKILL.md)

每个实际 Go 包维护同目录 README 与包注释。架构测试约束 Gin、数据库驱动的依赖方向，并检查包文档；沿用 Go 的 connection/metadata/query 职责文件，不机械套用前端 index 目录规则。

Go + Gin 服务，数据库访问使用 `database/sql` + MySQL 驱动及 PostgreSQL pgx 驱动。完整启动和 API 说明见 [根目录 README](../README.md)、[API 文档](../docs/API.md) 和 [数据库支持范围](../docs/DATABASES.md)。

项目已按职责分层：`cmd/sql-studio` 为启动入口；`internal/app` 装配服务；`internal/config` 处理配置；`internal/httpapi` 负责 Gin 路由和中间件；`internal/service` 负责业务规则并通过注册器分派协议；`internal/model` 定义数据契约；`internal/mysql`、`internal/postgres` 执行两类协议操作；`internal/connection` 保存加密连接。完整文件职责、调用方向和扩展规范见 [后端架构](../docs/BACKEND_ARCHITECTURE.md)。

## 启动

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-server
$env:SQLDESK_MYSQL_PASSWORD = '00000000'
go run ./cmd/sql-studio
```

请从后端根目录启动，沿用 `data/` 中的已有连接和密钥。直接执行 `go run ./cmd/sql-studio`。退出信号触发 HTTP 服务停止接收请求，并给予在途请求 5 秒结束时间。

## 格式化

在当前后端目录的 PowerShell 中执行：

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-server
gofmt -w .         # gofmt 格式化所有 Go 源码与测试
gofmt -l .  # 只列出未格式化文件，输出应为空
```

使用标准 `gofmt`，Go 文件为 Tab 缩进和 LF 换行。`.vscode/settings.json` 指定 Go 扩展和保存时格式化，根目录 `.editorconfig` 提供文本规范。

## 检查

```powershell
go test -count=1 ./...
go vet ./...
go build ./...
# 等价于：格式检查 + go test ./... + go vet ./... + go build ./...

# 使用真实 MySQL 的独立临时库回归
$env:SQLDESK_MYSQL_PASSWORD = '00000000'
$env:SQLDESK_INTEGRATION = '1'
go test -count=1 ./...

# 可选 PostgreSQL 独立测试实例（需有建库权限）
$env:SQLDESK_PG_HOST = '127.0.0.1'
$env:SQLDESK_PG_PORT = '5432'
$env:SQLDESK_PG_USER = 'postgres'
$env:SQLDESK_PG_PASSWORD = '填写实际测试密码'
$env:SQLDESK_INTEGRATION = '1'
$env:SQLDESK_PG_INTEGRATION = '1'
go test -count=1 ./...
```

各包单元测试与实现同目录，真实集成测试位于 `tests/integration`，默认跳过，设置对应集成测试环境变量为 1 才启用。测试库创建与清理范围见根目录 README。检查使用 go build ./...，不覆盖当前运行的二进制；集成验证后自行清除对应环境变量。重构保留现有 HTTP 契约、凭据保存格式和数据目录。
