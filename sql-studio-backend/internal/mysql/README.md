# MySQL 协议驱动

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

MySQL 的连接测试、结构读取、DDL 与 SQL 执行。

## 约束与调用

SQL 默认只读事务，单语句执行；结果行数/约 8MiB 限制，保留 BIGINT/DECIMAL 精度与 NULL；标识符严格转义。

query_test.go 通过 database/sql 测试驱动验证实际扫描与事务流程：精确有符号/无符号整数、DECIMAL、二进制、NULL、重复列名、行数/字节边界、错误和取消、游标关闭及写入反馈；不建立网络连接，不能代替真实 MySQL 的协议和只读权限集成验证。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

`Indexes(ctx, connection, ref) ([]model.Index, error)` 用显式库表参数查询 information_schema.STATISTICS，主键在前，其余按名称和字段序号排序并聚合复合索引。保留唯一性、类型、字段位置、可空前缀长度和 A/D/空排序方向；兼容没有 EXPRESSION 列的 MySQL 版本，表达式字段仅返回空名称。继承请求取消，关闭连接及游标，错误原样返回。metadata_test.go 用 SQL 测试驱动检查复合索引、空结果和游标错误。

Client 跟踪每个请求的连接 ID、库、取消器与完成信号。SetSession(ctx, connection, database *string, open bool) 省略库为整个连接；关闭先阻止新请求，取消全部目标请求，并等待请求 defer 关闭 sql.DB 后才返回成功，驱动关闭错误/超时原样返回。打开用实际 Ping 验证连通性；不同请求仍不共享会话。lifecycle_test.go 使用真实 database/sql 与测试驱动验证底层 Close、范围隔离、阻止新请求及超时失败；不会终止其他客户端会话。

显式“测试连接”允许临时探测已关闭配置，探测结束释放物理连接且不改变工作台打开状态；关闭正在进行时，探测同样被阻止。lifecycle_test.go 覆盖这条兼容边界。
