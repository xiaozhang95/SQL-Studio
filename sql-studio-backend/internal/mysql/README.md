# MySQL 协议驱动

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

MySQL 的连接测试、结构读取、DDL 与 SQL 执行。

GreptimeDB 通过 `NewClientWithDefaultDatabase` 指定维护库，沿用连接租约和元数据读取。`ExecuteStatement` 接收调用引擎已校验和分类的单条 SQL，使用共享的自动提交、结果读取、取消和大小限制。

`ExecuteBatch` 为 MySQL 和 MariaDB 工作台提供独立物理连接，在连接内依次执行已切分的 SQL。SQL 模式、用户变量和显式事务持续至批次结束。成功 USE 更新租约的数据库范围，关闭目标数据库可取消请求。结果超出限制时在语句期限内关闭并排空游标，以复用同一连接。驱动仍关闭协议级多语句。

## 约束与调用

SQL 默认只读事务，单语句执行；结果行数/约 8MiB 限制，保留 BIGINT/DECIMAL 精度与 NULL；标识符严格转义。

MySQL DDL 会隐式提交，单靠只读事务不足以保护普通查询。默认入口仅接受 SELECT/SHOW/DESC/DESCRIBE/EXPLAIN/TABLE/VALUES、查询型 WITH 和 USE，发送前拒绝其他语句及字符串/普通注释之外的可执行版本注释。读查询继续使用只读事务；显式 allowWrite=true 的对象与数据操作保持原行为。statement_test.go、query_test.go 覆盖隐式提交与可执行注释边界；前端可选真实 SQL 窗口测试同时验证拒绝后数据和结构未改变。

query_test.go 通过 database/sql 测试驱动验证实际扫描与事务流程：精确有符号/无符号整数、DECIMAL、二进制、NULL、重复列名、行数/字节边界、错误和取消、游标关闭及写入反馈；不建立网络连接，不能代替真实 MySQL 的协议和只读权限集成验证。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

`Indexes(ctx, connection, ref) ([]model.Index, error)` 用显式库表参数查询 information_schema.STATISTICS，主键在前，其余按名称和字段序号排序并聚合复合索引。保留唯一性、类型、字段位置、可空前缀长度和 A/D/空排序方向；兼容没有 EXPRESSION 列的 MySQL 版本，表达式字段仅返回空名称。继承请求取消，关闭连接及游标，错误原样返回。metadata_test.go 用 SQL 测试驱动检查复合索引、空结果和游标错误。

Client 跟踪每个请求的连接 ID、库、取消器与完成信号。SetSession(ctx, connection, database *string, open bool) 省略库为整个连接；关闭先阻止新请求，取消全部目标请求，并等待请求 defer 关闭 sql.DB 后才返回成功，驱动关闭错误/超时原样返回。打开用实际 Ping 验证连通性；不同请求仍不共享会话。lifecycle_test.go 使用真实 database/sql 与测试驱动验证底层 Close、范围隔离、阻止新请求及超时失败；不会终止其他客户端会话。

显式“测试连接”允许临时探测已关闭配置，探测结束释放物理连接且不改变工作台打开状态；关闭正在进行时，探测同样被阻止。lifecycle_test.go 覆盖这条兼容边界。

Schemas 返回空数组：MySQL 数据库本身即 schema，不引入额外的 schema 展示层，也不增加网络请求。

readRows 按返回结果列数量设置 IsQuery：无列成功是执行回执，有列但零行仍是查询结果；不改动只读事务或执行权限。

QueryRequest.Schema 非空明确拒绝，避免把 PostgreSQL 范围静默用于 MySQL；省略/空值保持兼容。

export.go 的 StreamTableData(ctx,connection,ref,emit) 在指定库表创建只读 REPEATABLE READ 事务，按字段顺序显式读取可访问列（含不可见列），通过 rowstream 分批回调，无总行数限制；继承连接/库关闭租约、请求取消及超时。单表数据快照不等于整个数据库一致性备份，DDL/其他表由其他请求读取。

MariaDB 独立引擎组合本包共享协议实现；driverConfig 明确接受 mariadb 类型并保留原类型。默认读取同时拒绝 /*! 和 /*M! 可执行注释；显式写入的顶层 INSERT/DELETE/REPLACE RETURNING 走结果读取，不丢失返回列/行。分类忽略字符串、标识符、注释和嵌套表达式中的 RETURNING 文本。

单元格更新可显式传QueryRequest.MatchRows=true；该次独立连接启用CLIENT_FOUND_ROWS，affectedRows表示匹配行，等价赋值不误报并发冲突；0行仍失败。普通查询/SQL写入连接默认不启用。请求仍走同一租约、关闭/取消及独立物理连接生命周期。

`CheckDatabaseSync` 和 `SyncDatabase` 使用独立物理会话检查目标、执行原子排他建库、复制 InnoDB 建表定义并可选用参数化批次传输数据。数据模式在同一个只读事务中检查表结构并读取一致性快照，源表的元数据锁在事务结束后释放。目标会话显式启用自动提交，逐批回报已确认记录。取消不删除已创建对象，断开时最后一个在途批次可能已提交。

`ForeignKeys(ctx, connection, ref)` 按库表读取 information_schema 中的外键，保留跨库引用、更新与删除规则和复合约束的列映射顺序。

监控通过 SHOW GLOBAL STATUS 读取连接、运行线程、客户端语句、慢查询、连接失败、收发流量及运行时间。
