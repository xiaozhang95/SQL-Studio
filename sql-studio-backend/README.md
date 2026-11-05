# SQL Studio 后端

[包索引](internal/README.md) · [后端规范](../docs/BACKEND_STANDARDS.md) · [后端 skill](../.agents/skills/sql-studio-backend/SKILL.md)

Go + Gin 模块化单体：一个 Go module、进程和 HTTP 服务，连接管理、数据库对象、SQL 查询为独立业务模块。每个模块维护自己的入口、最小消费接口、规则、README、包注释和测试；模块之间不直接导入，app 在进程内注入具体实现。

根目录 [main.go](main.go) 为唯一启动入口，只加载配置、创建 app 和处理退出；`internal/app` 装配模块和生命周期；`internal/httpapi` 负责路由、参数与响应；`internal/modules` 按业务拆分；`internal/model` 是共享契约；`internal/mysql` 实现 MySQL；`internal/connection` 负责加密连接仓库；`internal/config` 读取环境变量。依赖与请求边界见 [架构说明](../docs/BACKEND_ARCHITECTURE.md)，HTTP 契约见 [API](../docs/API.md)。

## 启动

从仓库进入后端目录，使用原生命令：

```sh
cd sql-studio-backend
go run main.go
```

服务监听 `127.0.0.1:18080`，日志直接输出终端，Ctrl+C 退出并给予在途请求 5 秒结束时间。当前不提供启停脚本、后台 PID、日志文件和部署配置。

开发时从后端根目录启动，连接与密钥默认与布局配置一起保存在服务启动工作目录下的 `./.sql-studio/state/`，网页目录为 `../sql-studio-frontend/dist`。没有保存连接时可在网页创建；可选首次初始化环境变量及数据库范围见 [数据库支持](../docs/DATABASES.md)。现有配置和密钥不因启动参数而覆盖，不删除运行数据。

## 含前端的独立可执行文件

在仓库根目录执行 `./build.ps1`，脚本构建前端、同步到 `internal/webui/dist`，然后使用 `go build -tags embedded` 编译；完整命令和跨平台参数见 [一键打包](../README.md#一键打包)。不要跳过前端同步直接复用旧资源。

产物位于仓库 `release/`，Windows x64 为 `sql-studio-windows-amd64.exe`。运行后从 `/` 访问工作台、`/swagger.html` 访问 Swagger；可执行文件可从独立目录运行，前端文件已内嵌。设置 `SQLDESK_WEB_DIR` 可显式覆盖为外部 dist。普通无标签构建仍使用磁盘 dist。

监听地址默认 `127.0.0.1:18080`，可通过 `SQLDESK_ADDR` 指定其他地址（例如 `127.0.0.1:18081`）以避开已有服务；不会自动停止已有进程。

默认配置目录保持不变。Windows 打包附带可选 start-sql-studio-<架构>.cmd，失败时暂停窗口以查看端口或权限错误；日志和保存错误带实际 PID/程序路径，避免将旧 go run 服务误认为打包程序。出现 Access is denied 或双击退出时见 [启动失败与配置保存提示](../README.md#启动失败与配置保存提示)。不自动更换目录、修改权限或停止其他服务。

脚本生成资源后可执行 `go test -tags embedded -count=1 ./...`，包含从临时工作目录读取内嵌页面及真实构建 JS 的验证；默认 `go test ./...` 不要求生成 dist。包边界见 [webui](internal/webui/README.md)。

## 检查

在 `sql-studio-backend` 直接执行：

```sh
gofmt -w .
gofmt -l .
go test -count=1 ./...
go vet ./...
go build ./...
```

`gofmt -l .` 应无输出。普通测试只用临时目录和替身；架构测试独立约束模块导入方向及递归包文档，不依赖 Node。`go build ./...` 不覆盖当前运行的二进制。不保留检查包装脚本，有效回归归入 Go 测试。

真实 MySQL 测试位于 `tests/integration`，默认跳过；需要时在终端设置 `SQLDESK_INTEGRATION=1` 及实际连接环境变量，再运行 `go test -count=1 ./...`。它只操作随机创建的 `sqldesk_test_<随机ID>` 临时库，结束清理；运行后移除本次设置的环境变量。重构不改变 HTTP 契约、凭据格式和数据目录。

PolarDB PostgreSQL 由 internal/postgresql 独立实现，经 internal/database 分派；维护库、能力范围和 schema 身份见 [数据库支持](../docs/DATABASES.md)。真实 PostgreSQL 回归设置 `SQLDESK_PG_INTEGRATION=1` 和 `SQLDESK_PG_PASSWORD`，使用本机 5432 端口、postgres 账号及 postgres 数据库；测试创建随机 schema 并在结束时清理。默认测试使用替身，不连接真实数据库。

MariaDB 11.4 由 internal/mariadb 独立组装，共用 MySQL 线协议。真实回归：设置 SQLDESK_MARIADB_INTEGRATION=1、SQLDESK_MARIADB_PASSWORD，可选 SQLDESK_MARIADB_HOST/SQLDESK_MARIADB_PORT（测试默认 127.0.0.1:3307），执行 `go test -count=1 -v ./tests/integration -run TestMariaDBIntegration`。仅创建随机 sqldesk_mariadb_ 临时库，覆盖真实元数据、精确值、RETURNING、6102 行流式读取、只读边界、取消及关闭重开，并验证清理；不读取现有业务表。
