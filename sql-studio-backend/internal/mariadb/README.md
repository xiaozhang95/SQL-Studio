# MariaDB 引擎

NewClient() 返回独立 Client，实现连接测试、会话打开/关闭、数据库/表/视图/字段/索引/外键/DDL、Execute 和 StreamTableData。app 按 mariadb 类型注册；类型始终保留，不转换为 mysql。复用 internal/mysql 的线协议、元数据读取和有界游标，不复制驱动及生命周期代码；每个实例独立拥有请求租约、关闭与取消状态。

目标版本 MariaDB 11.4。默认端口为 3306，Docker 映射需使用宿主机端口，例如 3307；密码仅由连接仓库加密保存。查询请求不接受独立 schema，数据库即 schema；每次请求独立连接，不跨请求共享事务/SET。

API 默认只读：拒绝 DDL、DML 和 MySQL/MariaDB 可执行注释；显式写入支持 DDL/DML 及 INSERT/DELETE/REPLACE RETURNING，返回精确列/行。继承超时、行数/字节限制、连接关闭与 context 取消。流式导出为单表只读快照，不是全库一致性备份；序列、系统版本历史等专属对象使用 SQL 或原生备份工具。

真实集成见 tests/integration/mariadb_test.go；默认跳过，通过 SQLDESK_MARIADB_INTEGRATION=1 和 SQLDESK_MARIADB_PASSWORD 启用，端口可由 SQLDESK_MARIADB_PORT 覆盖，只写入随机临时库并清理。

数据库同步复用 InnoDB 同步协议，按 FULL_COLLATION_NAME 查询排序规则（含 UCA1400），保留不可见列。跳过视图和独立序列，系统版本表不在范围内。
