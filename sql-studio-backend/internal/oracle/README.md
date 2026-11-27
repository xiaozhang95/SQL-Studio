# Oracle 引擎

[后端包索引](../README.md) · [连接与功能说明](../../../docs/DATABASES.md#oracle)

`NewClient()` 通过纯 Go 的 go-ora 实现 `database.Engine`。连接使用主机、端口及服务名，默认服务为 `FREEPDB1`。TLS 使用系统信任库并校验服务端主机名。连接测试返回 Oracle 完整版本，凭据沿用连接仓库。每个操作拥有独立物理会话，请求结束释放。关闭连接或服务会取消对应在途请求并等待释放。取消也关闭该请求的 TCP 连接，以便中断未响应协议取消的网络路径。

`Databases` 返回连接配置的服务名。`Schemas` 返回登录用户的 Schema 及具有可见表或视图的用户 Schema。`Tables`、`Columns`、`Indexes`、`ForeignKeys` 和 `DDL` 通过 Oracle 目录视图读取，表和视图使用 `"OWNER"."OBJECT"` 身份。DDL 来自 `DBMS_METADATA`，附独立索引和注释。工作台 DDL 接口提供 30 秒期限，以容纳首次加载目录。数据库根据登录用户的目录权限决定可见和可导出的对象。

`Execute` 接收单条 SQL 或完整 PL/SQL 块。默认只读通过 Oracle `SET TRANSACTION READ ONLY` 执行 SELECT，写入由调用者显式启用。可选 Schema 通过同一物理会话设置 `CURRENT_SCHEMA`。返回受共享查询超时、并发及行数限制约束，结果预算约 8 MiB。NUMBER 转成精确文本，RAW/BLOB 以十六进制表示。Oracle 错误映射到共享语句和约束错误类别。首次取得结果前遇到旧快照错误 ORA-01466 时，只读请求在原有期限内回滚并刷新快照。

`ExecuteBatch` 使用一个会话。普通脚本逐条提交。含 COMMIT、ROLLBACK、SAVEPOINT 或 SET TRANSACTION 的脚本由显式事务控制。出错、取消或事务尚未结束时停止并释放会话，已提交的写入及 Oracle DDL 隐式提交保留。匿名块与存储程序文本由 Oracle 解析，编辑器识别独立一行的 `/`。

`StreamTableData` 使用只读游标分批读取含不可见列的表数据。监控的基础指标为登录用户的对象统计，有权限时读取当前容器的用户会话。

同步以源和目标 Schema 为范围，目标需是目标账号拥有的空 Schema。检查只读。执行重新检查目标、生成普通表及索引、可选复制数据、最后恢复外键。源数据使用同一只读快照，数据按表提交。相关列类型、依赖和故障恢复边界见数据库说明。

`TestOracleIntegration` 仅在设置 `SQLSTUDIO_ORACLE_TEST_PASSWORD` 和 `SQLSTUDIO_ORACLE_TEST_PORT` 后执行。可用 `SQLSTUDIO_ORACLE_TEST_USER` 指定隔离源用户，`SQLSTUDIO_ORACLE_SYNC_TARGET` 启用同密码的独立空目标 Schema 测试。只在可销毁的容器运行，随机测试对象由容器一起清理。
