# 后端架构与维护规范

## 目录与依赖

- cmd/sql-studio：读取配置、创建应用、监听退出信号。
- internal/app：组合根，创建 connection.Store 和 mysql.Client，注入 service，装配 Gin API 与静态文件。
- internal/config：统一读取环境变量、解析数据及网页目录、校验首次连接端口。
- internal/httpapi：Gin 路由、参数解码、响应状态、同源及本机保护；不直接使用驱动或文件系统。
- internal/service：声明 ConnectionRepository/Database 接口，编排连接、元数据、SQL 及并发策略。
- internal/model：Connection、TableRef、Table、Column、QueryRequest、QueryResult 等契约，仅接受 MySQL 类型。
- internal/mysql：MySQL 驱动参数、TLS、连接测试、information_schema/SHOW 元数据与 SQL 执行。
- internal/connection：连接 CRUD、AES-GCM 加密、原子落盘。

依赖方向：cmd → config/app；app → config/connection/mysql/service/httpapi/Gin；httpapi → service/model/Gin；service → model；connection/config → model/标准库；mysql → model/MySQL 驱动。新增层必须更新 tests/architecture 的依赖约束及 README。

仅保留 MySQL 实现，app 将 mysql.NewClient() 直接传入 service.New，不保留多协议注册表或其他驱动依赖。服务层过滤已保存的非 MySQL 连接，不删除磁盘记录；保存、测试或驱动操作仍会拒绝非 MySQL 类型，空类型兼容旧 MySQL 连接。

## 请求边界

HTTP 请求体最多 1 MiB，拒绝未知字段与多 JSON 对象。SQL 非空、单语句执行，默认只读事务；后端显式 allowWrite 仍允许自动提交，前端不暴露写入开关或行数参数。默认 1000 行、最高 5000 行、约 8 MiB 字段内容、最长 30 秒、4 并发，元数据最长 10 秒。取消不能被描述为事务已回滚。

每次请求使用独立数据库连接，关闭游标及连接；精确整数与 DECIMAL 保留文本、二进制转为十六进制，保留 NULL 与重复列名。元数据以数据库和表名确定对象，标识符反引号转义，元数据筛选使用参数绑定。

错误状态：不存在连接 404，并发超限 429，其他输入或数据库错误 400。见 [API](API.md) 和 [数据库支持](DATABASES.md)。

## 配置与生命周期

config.Load 读取 SQLDESK_DATA_DIR、SQLDESK_WEB_DIR、SQLDESK_MYSQL_*。从 sql-server 根目录执行 go run ./cmd/sql-studio，默认 data/ 和 ../sql-web/dist；只在没有可用连接时按环境变量初始化，不覆盖已有连接密码。连接沿用 connections.json 与 master.key；密钥丢失拒绝覆盖，不记录明文密码。HTTP 退出时给予在途请求 5 秒结束时间。

## 维护与验证

包内实现与单元测试同目录，跨层测试位于 tests；每个实际包有 README 与 doc.go。修改实现、调用方、契约和相关说明同步维护。

在 sql-server 执行 gofmt -w .、go test -count=1 ./...、go vet ./...、go build ./...；根目录执行 node scripts/check-structure.mjs。真实 MySQL 集成参数见 [后端 README](../sql-server/README.md)，只使用自动生成的临时库。验证历史见 [验证记录](VERIFICATION.md)。
