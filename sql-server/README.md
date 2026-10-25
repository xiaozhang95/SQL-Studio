# SQL Studio 后端

[包索引](internal/README.md) · [后端规范](../docs/BACKEND_STANDARDS.md) · [后端 skill](../.agents/skills/sql-studio-backend/SKILL.md)

Go + Gin 模块化单体：一个 Go module、进程和 HTTP 服务，连接管理、数据库对象、SQL 查询为独立业务模块。每个模块维护自己的入口、最小消费接口、规则、README、包注释和测试；模块之间不直接导入，app 在进程内注入具体实现。

`cmd/sql-studio/main.go` 为唯一启动入口；`internal/app` 装配模块和生命周期；`internal/httpapi` 负责路由、参数与响应；`internal/modules` 按业务拆分；`internal/model` 是共享契约；`internal/mysql` 实现 MySQL；`internal/connection` 负责加密连接仓库；`internal/config` 读取环境变量。依赖与请求边界见 [架构说明](../docs/BACKEND_ARCHITECTURE.md)，HTTP 契约见 [API](../docs/API.md)。

## 启动

从仓库进入后端目录，使用原生命令：

```sh
cd sql-server
go run ./cmd/sql-studio/main.go
```

服务监听 `127.0.0.1:8080`，日志直接输出终端，Ctrl+C 退出并给予在途请求 5 秒结束时间。当前不提供启停脚本、后台 PID、日志文件和部署配置。

始终从后端根目录启动，默认使用已有 `data/` 连接与密钥，网页目录为 `../sql-web/dist`。没有保存连接时可在网页创建；可选首次初始化环境变量及数据库范围见 [数据库支持](../docs/DATABASES.md)。现有配置和密钥不因启动参数而覆盖，不删除运行数据。

## 检查

在 `sql-server` 直接执行：

```sh
gofmt -w .
gofmt -l .
go test -count=1 ./...
go vet ./...
go build ./...
```

`gofmt -l .` 应无输出。普通测试只用临时目录和替身；架构测试独立约束模块导入方向及递归包文档，不依赖 Node。`go build ./...` 不覆盖当前运行的二进制。不保留检查包装脚本，有效回归归入 Go 测试。

真实 MySQL 测试位于 `tests/integration`，默认跳过；需要时在终端设置 `SQLDESK_INTEGRATION=1` 及实际连接环境变量，再运行 `go test -count=1 ./...`。它只操作随机创建的 `sqldesk_test_<随机ID>` 临时库，结束清理；运行后移除本次设置的环境变量。重构不改变 HTTP 契约、凭据格式和数据目录。
