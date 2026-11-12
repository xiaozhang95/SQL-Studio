# 数据库连接说明

| 引擎 | type | 默认端口 | 维护数据库 |
| --- | --- | --- | --- |
| MySQL | mysql | 3306 | 不需要 |
| MariaDB | mariadb | 3306 | 不需要；Docker 端口映射按宿主机填写 |
| PolarDB PostgreSQL / PostgreSQL | postgresql | 5432 | postgres，可改为账号有权连接的库 |

PolarDB PostgreSQL 使用 PostgreSQL 协议，不包含 Oracle 兼容版。前端实现分别放在 `src/databases/mysql`、`src/databases/mariadb` 和 `src/databases/postgresql`，后端在 `internal/mysql`、`internal/mariadb` 和 `internal/postgresql`；统一入口只组合和分派。新增引擎按契约注册，不在 MySQL 模块或通用 UI 中拼另一种方言。

连接表单可选引擎，切换新建类型更新默认端口和维护库并保留其他已填信息；编辑已有连接不更换引擎。名称、主机、用户名不预填。密码仅后端 AES-GCM 保存，编辑留空保留旧密码；连接分组默认“默认分组”，只影响树布局。SSL 启用后校验证书链和主机名，不提供跳过校验；暂不支持自定义 CA、客户端证书、SSH 隧道。

连接和加密密码保存在本地 connections.json，密钥位于 master.key。当前连接文件必须明确保存 type/group；未支持类型留在磁盘但不返回可用列表，不自动转换类型。

每个查询页独立保存连接、数据库、表和 SQL。MySQL/MariaDB/PostgreSQL SQL 窗口显式允许查询、DDL 和 DML；API 未指定 allowWrite 时仍默认只读。每个 API 请求单语句、最长 30 秒、默认 1000 最大 5000 行、约 8 MiB 字段内容。整数/DECIMAL/NUMERIC 保持文本，二进制转十六进制，保留 NULL 和重复列名。失败或取消停止后续语句，保留已完成结果。各条请求不共享事务、SET 或临时表，取消不表示回滚。

MySQL 和 MariaDB 使用反引号和 SHOW CREATE TABLE；成功的 USE 更新发起查询页的库并显式传给后续请求。PostgreSQL 在顶部数据库选择器切换连接目标，不支持 USE；默认未选库时连接维护库。其表/视图使用完整 `"schema"."table"` 身份，预览 SQL 仅限定 schema/table，数据库通过请求字段传递。不同 schema 的同名表互不混淆。脚本切分支持美元引号、E 字符串与嵌套块注释；普通字符串按后端强制 standard_conforming_strings=on。

PostgreSQL 当前支持连接测试、数据库/表/视图/字段/索引浏览、查询与补全、完整主键数据行编辑、DDL 查看与结构参考导出；右键支持新建/编辑/删除数据库、删除或重命名表及视图、清空表。编辑数据库可修改所有者、连接数上限和注释，名称、编码和排序规则只读，权限由数据库校验。可从 schema 下新建表并设计已有字段；复杂定义边界见 [表设计说明](../sql-studio-frontend/src/databases/postgresql/tableDesign/README.md)。库、Schema 和表菜单支持结构和数据转储，分批读取并保留精确值、BYTEA、NULL、自有 SERIAL/IDENTITY 和生成列定义。视图可导出结构。流式限制与文件提交条件见 [功能汇总](FEATURES.md#10-sql-文件与数据导出)。依赖类型/函数/外键目标需预先存在；分区表、外部/共享序列等不能完整转储时提示使用 pg_dump。读取不是并发写入下的一致备份，完整备份仍使用 pg_dump。

真实 MySQL 和 MariaDB 回归使用随机临时库，PostgreSQL 回归使用随机 schema，环境变量见 [后端 README](../sql-studio-backend/README.md)。默认跳过真实数据库测试。

连接方式参考 [阿里云 PolarDB PostgreSQL 官方说明](https://www.alibabacloud.com/help/en/polardb/polardb-for-postgresql/connect-to-polardb/)。当前目录元数据实现要求 PostgreSQL 12 或更新版本（含 identity/generated 目录字段）。

PostgreSQL 对象树按数据库 → schema → 表/视图 → 对象展示；从真实 schema 列表保留空 schema。表标签仅显示本层名称，API/缓存仍保留完整身份。

PostgreSQL 数据库结构页展示 schema 列表，schema 结构页展示该 schema 内的表和视图。MySQL 和 MariaDB 数据库结构页展示表列表。

PostgreSQL 支持新建、重命名和删除 Schema；删除采用 RESTRICT，只允许删除空 Schema。重命名更新相关页面范围，但不改写 SQL 草稿或历史结果。

PostgreSQL 查询页可独立选择 schema。物理数据库与 schema 分别保存/请求，未限定表名在所选 schema 中解析；清空使用服务器默认搜索路径。结构列表分列 Schema/表名，对象页标签为 schema.table，历史与刷新记录执行时 schema。工作区恢复直接读取当前结果快照。

## MariaDB 11.4

MariaDB 为独立 mariadb 类型，前端 src/databases/mariadb、后端 internal/mariadb 分别组装适配器。底层显式复用 MySQL 线协议、反引号及数据库即 schema 的层级；补全使用 MariaSQL。支持连接测试/保存、库表/视图/字段/索引、SQL 窗口 DDL/DML、USE、多结果、INSERT/DELETE/REPLACE RETURNING、表设计、主键数据编辑及 SQL 转储。

字段默认值按 MariaDB 的带引号字面值规则解析；复杂表达式及含反斜线的默认字面值保持锁定，避免改变未知 SQL mode 下的定义。排序规则从 COLLATION_CHARACTER_SET_APPLICABILITY 读取完整名称与字符集映射，保留 UCA1400 并优先 utf8mb4；表列表不把 SEQUENCE 冒充普通表。/*! 与 /*M! 在脚本中保留，默认只读 API 拒绝它们；显式写入仍由服务器执行。

转储范围为表/视图，不包含独立序列、系统版本历史、例程、触发器、事件和授权；系统版本表带数据转储明确提示使用 mariadb-dump。单表流式读取有界内存并支持取消，跨表不保证一致快照。

Docker 使用 -p 3307:3306 时，新建连接选择 MariaDB，主机填 127.0.0.1，端口填 3307，账号使用授权账号；打开后可选择容器初始化的 testdb。产品默认端口仍为 3306，映射端口由连接配置决定。密码不进入源码、文档或工作区快照。
