# 数据库连接说明

| 引擎 | type | 默认端口 | 维护数据库 |
| --- | --- | --- | --- |
| MySQL | mysql | 3306 | 不需要 |
| PolarDB PostgreSQL / PostgreSQL | postgresql | 5432 | postgres，可改为账号有权连接的库 |

PolarDB PostgreSQL 使用 PostgreSQL 协议，不包含 Oracle 兼容版。前端实现独立放在 `src/databases/mysql` 与 `src/databases/postgresql`，后端在 `internal/mysql` 与 `internal/postgresql`；统一入口只组合和分派。新增引擎按契约注册，不在 MySQL 模块或通用 UI 中拼另一种方言。

连接表单可选引擎，切换新建类型更新默认端口和维护库并保留其他已填信息；编辑已有连接不更换引擎。名称、主机、用户名不预填。密码仅后端 AES-GCM 保存，编辑留空保留旧密码；连接分组默认“默认分组”，只影响树布局。SSL 启用后校验证书链和主机名，不提供跳过校验；暂不支持自定义 CA、客户端证书、SSH 隧道。

连接和加密密码保存在本地 connections.json，密钥位于 master.key。旧连接缺少 type 时兼容 MySQL；未支持类型留在磁盘但不返回可用列表，不自动转换类型。

每个查询页独立保存连接、数据库、表和 SQL。查询默认只读事务；每个 API 请求单语句、最长 30 秒、默认 1000 最大 5000 行、约 8 MiB 字段内容。整数/DECIMAL/NUMERIC 保持文本，二进制转十六进制，保留 NULL 和重复列名。失败或取消停止后续语句，保留已完成结果。各条请求不共享事务、SET 或临时表，取消不表示回滚。

MySQL 使用反引号和 SHOW CREATE TABLE；成功的 USE 更新发起查询页的库并显式传给后续请求。PostgreSQL 在顶部数据库选择器切换连接目标，不支持 USE；默认未选库时连接维护库。其表/视图使用完整 `"schema"."table"` 身份，预览 SQL 仅限定 schema/table，数据库通过请求字段传递。不同 schema 的同名表互不混淆。脚本切分支持美元引号、E 字符串与嵌套块注释；普通字符串按后端强制 standard_conforming_strings=on。

PostgreSQL 当前支持连接测试、数据库/表/视图/字段/索引浏览、查询与补全、完整主键数据行编辑、DDL 查看与结构参考导出；右键支持新建和删除数据库、删除或重命名表及视图、清空表。可从 schema 下新建表，并设计已有表字段；生成列和复杂默认表达式的编辑有边界，见 [表设计说明](../sql-studio-frontend/src/databases/postgresql/tableDesign/README.md)。库属性编辑与结构数据联合转储尚未实现。DDL 是目录重建的结构参考，含约束/索引/分区键，不能替代 pg_dump 完整备份；分区子表和外部表明确提示使用 pg_dump。

真实 MySQL 和 PostgreSQL 回归分别使用随机临时库和 schema，环境变量见 [后端 README](../sql-studio-backend/README.md)。默认跳过真实数据库测试。

连接方式参考 [阿里云 PolarDB PostgreSQL 官方说明](https://www.alibabacloud.com/help/en/polardb/polardb-for-postgresql/connect-to-polardb/)。当前目录元数据实现要求 PostgreSQL 12 或更新版本（含 identity/generated 目录字段）。

PostgreSQL 对象树现按数据库 → schema → 表/视图 → 对象展示；从真实 schema 列表保留空 schema。表标签仅显示本层名称，API/缓存仍保留完整身份。

PostgreSQL 数据库结构页展示 schema 列表，schema 结构页展示该 schema 内的表和视图；MySQL 数据库结构页仍展示表列表。已恢复的旧结果在刷新前保留原快照。

PostgreSQL 支持新建、重命名和删除 Schema；删除采用 RESTRICT，只允许删除空 Schema。重命名更新相关页面范围，但不改写 SQL 草稿或历史结果。

PostgreSQL 查询页可独立选择 schema。物理数据库与 schema 分别保存/请求，未限定表名在所选 schema 中解析；清空使用服务器默认搜索路径。结构列表分列 Schema/表名，对象页标签为 schema.table，历史与刷新记录执行时 schema。旧结果展示转换不会自动重跑 SQL。
