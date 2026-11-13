# PostgreSQL 协议驱动

[包索引](../README.md) · [数据库支持](../../../docs/DATABASES.md)

NewClient() 返回 PostgreSQL 实现；公开方法 Test/SetSession/Databases/Tables/Columns/Indexes/DDL/Execute 使用 model 契约，context 始终透传。仅支持 type=postgresql，使用 pgx v5 的 database/sql 适配。维护库取 Connection.Database，空值默认 postgres；请求指定数据库优先，不能使用 USE 切换物理数据库。TLS=true 使用 verify-full，无明文回退、跳过证书验证或自定义 CA 表单。驱动配置不记录密码，数据库返回错误原样传播。

connection.go 管连接配置/测试，lifecycle.go 管请求租约、按连接和库关闭并等待物理释放；每次请求独立 sql.DB，无跨请求缓存或会话。元数据枚举有 CONNECT 权限的数据库及可读用户表/视图。Tables.Name 始终为双引号 schema/table 对，点号/引号保留，Columns/Indexes/DDL 接收同一身份；普通单名 API 参数按 public schema 解释，禁止猜测拆点。

metadata.go 从 pg_catalog 读取字段、主键、identity/generated、备注及索引顺序/表达式。索引保留真实名称和表达式定义，prefixLength=null；主键字段使用 key=PRI。视图列表含通过重写规则记录的直接视图依赖，仍使用完整 schema/table 身份，供转储排序。DDL 是目录重建的结构参考，含字段、约束、非约束索引和分区键；分区子表及外部表拒绝输出不完整定义。结构参考不含完整依赖、授权、序列状态或存储配置，完整备份请使用 pg_dump。

Tables 通过 pg_depend 标记扩展拥有的表和视图，使用可选 extension 返回扩展名称。对象仍可浏览，库级和 Schema 级转储用该字段排除扩展自身管理的对象。

query.go 默认只读事务、单语句（读路径使用 extended protocol，显式写入先 Prepare 后执行），query 业务模块仍管理 30 秒/4 并发/默认 1000 最大 5000 行，驱动管理约 8MiB 内容界限。INT8/NUMERIC 精度保留文本，BYTEA 使用 \x 十六进制、NULL 与重复列名保留。写入反馈用 affectedRows，PostgreSQL 不伪造 LastInsertID；返回生成值应显式使用 RETURNING。取消不等于写入回滚。事务、SET、临时表不跨请求继承。

测试以 database/sql 替身检查配置/TLS、结果精度与限制、游标取消、关闭和同名库隔离，不读取业务库。tests/integration/postgresql_test.go 可显式启用真实 PostgreSQL/PolarDB 测试；前端 tests/sql-window.integration.test.mjs 另验证实际 SQL 窗口编排与 HTTP 执行，仅操作随机临时 schema，配置见对应测试 README。

Schemas(ctx,connection,database) 从 pg_namespace 返回具 USAGE 权限的非系统 schema，包含空 schema。Schemas 和 Tables 均排除保留前缀 pg_ 与 information_schema，沿用请求取消和连接释放；树按真实 schema 列表分层。

readRows 的 IsQuery 由实际结果列数量决定，无列成功回执不冒充空 SELECT，原查询/事务/写入权限保持不变。

QueryRequest.Schema 非空时先在请求独占 sql.Conn 验证 schema 存在和 USAGE，再参数化 set_config(search_path,quoteIdentifier(schema),false)。该同一连接用于后续只读事务/显式写入；请求结束释放，不跨请求保留 schema。名称中的逗号、引号作为单个 schema 标识处理，不拼用户 SQL。

DDL 在本次独占物理连接将 search_path 固定为 pg_catalog，再进行全部目录反解析，确保 SERIAL 默认值、类型/函数和索引的跨 schema 引用明确限定，避免导出文件依赖源会话搜索路径。设置和读取使用同一 sql.Conn，请求结束释放，其他查询不继承。

export.go 的 StreamTableData(ctx,connection,ref,emit) 解析显式 schema/table，在只读 REPEATABLE READ 事务使用游标分批回调，保留文本精度与 BYTEA。继承库/连接关闭、取消及超时；单表快照不等于全库一致性备份。
