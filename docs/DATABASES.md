# 数据库连接说明

| 引擎 | type | 默认端口 | 维护数据库 |
| --- | --- | --- | --- |
| MySQL | mysql | 3306 | 不需要 |
| MariaDB | mariadb | 3306 | 不需要；Docker 端口映射按宿主机填写 |
| PolarDB PostgreSQL / PostgreSQL | postgresql | 5432 | postgres，可改为账号有权连接的库 |
| Oracle | oracle | 1521 | 服务名 FREEPDB1，可改为监听器注册的服务 |
| GreptimeDB | greptimedb | 4002 | public，可改为账号有权连接的库 |

PolarDB PostgreSQL 使用 PostgreSQL 协议。各引擎在前端 `src/databases` 和后端 `internal` 下独立注册，统一入口负责分派。MariaDB 和 GreptimeDB 复用 MySQL 线协议，并各自维护 SQL 与对象能力。

连接表单可选引擎，切换新建类型更新默认端口和维护库并保留其他已填信息；编辑已有连接不更换引擎。名称、主机、用户名不预填。密码仅后端 AES-GCM 保存，编辑留空保留旧密码；连接分组默认“默认分组”，只影响树布局。SSL 启用后校验证书链和主机名，不提供跳过校验；暂不支持自定义 CA、客户端证书、SSH 隧道。

连接和加密密码保存在本地 connections.json，密钥位于 master.key。当前连接文件必须明确保存 type/group；未支持类型留在磁盘但不返回可用列表，不自动转换类型。

每个查询页独立保存连接、数据库、表和 SQL。编辑器执行与重新执行按原 SQL 读取结果，行数由 SQL 决定，仍受每条约 8 MiB 的结果大小预算和 30 秒执行期限约束。首行超出结果预算时改为单独的只读预览。双击表、右键「查询数据」或刷新表数据页使用 `LIMIT 1000` 的只读预览。右键「新建查询」生成可编辑的普通 SELECT。编辑器显式允许查询、DDL 和 DML，API 默认只读。单语句和批次 JSON 请求最大 32 MiB。整数、DECIMAL 和 NUMERIC 保持文本，二进制转十六进制，保留 NULL 和重复列名。语句错误在发起页的消息和摘要中显示，执行请求和对象加载错误显示在顶部。打开已保存连接失败时，具体原因显示在左侧对应连接下方，可就地重试。主动取消在消息、摘要和历史中显示为「执行已取消」。失败或取消停止后续语句，保留已完成结果及已提交写入。

MySQL、MariaDB、PostgreSQL 和 Oracle 的多语句批次使用独立会话，批次内共享会话设置、临时对象及事务。请将事务控制语句和事务内 SQL 放在同一次运行中。批次结果通过原脚本重跑。MySQL 和 MariaDB 支持含 `DELIMITER` 的脚本，选中完整存储程序也可右键「作为单条 SQL 运行」。这两个引擎的 `CALL` 和 `EXECUTE` 返回的数据集各自显示为结果页签，执行历史按语句记录。批量写入事务表时，选中两条以上以 `INSERT` 开头的语句，可右键「在事务中运行 INSERT」，由工作台在同批次加入 `START TRANSACTION` 和 `COMMIT`。

MySQL 和 MariaDB 使用反引号和 SHOW CREATE TABLE。成功的 USE 更新发起查询页的库，批次内后续语句使用服务器当前库，独立请求则显式传入新库。PostgreSQL 在顶部数据库选择器切换连接目标，不支持 USE；默认未选库时连接维护库。其表/视图使用完整 `"schema"."table"` 身份，预览 SQL 仅限定 schema/table，数据库通过请求字段传递。不同 schema 的同名表互不混淆。脚本切分支持美元引号、E 字符串与嵌套块注释；普通字符串按后端强制 standard_conforming_strings=on。

PostgreSQL 当前支持连接测试、数据库/表/视图/字段/索引浏览、查询与补全、完整主键数据行编辑、DDL 查看与结构参考导出；右键支持新建/编辑/删除数据库、删除或重命名表及视图、清空表。编辑数据库可修改所有者、连接数上限和注释，名称、编码和排序规则只读，权限由数据库校验。可从 schema 下新建表并设计已有字段；复杂定义边界见 [表设计说明](../sql-studio-frontend/src/databases/postgresql/tableDesign/README.md)。库、Schema 和表菜单支持结构和数据转储，分批读取并保留精确值、BYTEA、NULL、自有 SERIAL/IDENTITY 和生成列定义。视图可导出结构。流式限制与文件提交条件见 [SQL 转储](#sql-转储)。依赖类型/函数/外键目标需预先存在；分区表、外部/共享序列等不能完整转储时提示使用 pg_dump。读取不是并发写入下的一致备份，完整备份仍使用 pg_dump。

MySQL、MariaDB 和 PostgreSQL（含 PolarDB PostgreSQL）的基础表支持在数据页查看、新增、编辑和删除。无主键时，编辑和删除按原始整行匹配。修改同一行的多个字段会一起保存，内容完全相同的记录每次只更新或删除一条。整行数据缺失或存在无法精确匹配的值时，界面会显示原因。

真实 MySQL 和 MariaDB 回归使用随机临时库，PostgreSQL 回归使用随机 schema，环境变量见 [后端 README](../sql-studio-backend/README.md)。默认跳过真实数据库测试。

连接方式参考 [阿里云 PolarDB PostgreSQL 官方说明](https://www.alibabacloud.com/help/en/polardb/polardb-for-postgresql/connect-to-polardb/)。当前目录元数据实现要求 PostgreSQL 12 或更新版本（含 identity/generated 目录字段）。

PostgreSQL 对象树按数据库 → schema → 表/视图 → 对象展示；从真实 schema 列表保留空 schema。表标签仅显示本层名称，API/缓存仍保留完整身份。MySQL、MariaDB 和 PostgreSQL 的表可展开外键分类，悬停查看引用库或 Schema、表、复合字段映射和更新、删除规则。

PostgreSQL 数据库结构页展示 schema 列表，schema 结构页展示该 schema 内的表和视图。MySQL 和 MariaDB 数据库结构页展示表列表。

PostgreSQL 支持新建、重命名和删除 Schema；删除采用 RESTRICT，只允许删除空 Schema。重命名更新相关页面范围，但不改写 SQL 草稿或历史结果。

PostgreSQL 查询页可独立选择 schema。物理数据库与 schema 分别保存/请求，未限定表名在所选 schema 中解析；清空使用服务器默认搜索路径。结构列表分列 Schema/表名，对象页标签为 schema.table，历史与刷新记录执行时 schema。工作区恢复直接读取当前结果快照。

## Oracle

新建连接选择 **Oracle**，输入监听地址、端口、服务名和数据库账号。默认端口为 `1521`，Oracle Free 的应用容器数据库服务名为 `FREEPDB1`。其他实例按监听器公布的服务填写。启用 TLS 时使用 Oracle TCPS 监听端口，并验证系统信任链及主机名。应用使用纯 Go 驱动，适配以 Oracle 19c 及之后版本为目标。

以下 PowerShell 命令可在本地 Docker 启动单独的 Oracle Free 实例，并提示输入管理员与应用账号的密码。

```powershell
$env:ORACLE_PASSWORD = Read-Host "Oracle admin password" -MaskInput
$env:APP_USER = "SQLSTUDIO"
$env:APP_USER_PASSWORD = Read-Host "SQLSTUDIO password" -MaskInput
docker run -d --name sql-studio-oracle -p 127.0.0.1:1521:1521 -e ORACLE_PASSWORD -e APP_USER -e APP_USER_PASSWORD gvenzl/oracle-free:23-slim
Remove-Item Env:ORACLE_PASSWORD, Env:APP_USER, Env:APP_USER_PASSWORD
docker logs --tail 30 sql-studio-oracle
```

日志出现 `DATABASE IS READY TO USE!` 后，在应用中填 `127.0.0.1`、`1521`、`FREEPDB1`、`SQLSTUDIO` 与应用账号密码。宿主机端口已占用时可使用 `127.0.0.1:1522:1521` 映射，并在连接表单填写 `1522`。[Oracle Free 容器说明](https://github.com/gvenzl/oci-oracle-free)

- 对象树按服务 → Schema → 表/视图显示，可展开列、主键、索引和外键。查看 DDL 使用 `DBMS_METADATA`，跨 Schema 读取完整 DDL 由数据库权限决定。
- SQL 窗口支持 SELECT、DDL、DML、PL/SQL、选区运行、补全、历史、结果导出和取消。表预览使用 `FETCH FIRST 1000 ROWS ONLY`。脚本通过分号切分 SQL，PL/SQL 块及程序定义用独立一行的 `/` 分隔。工作台普通写入逐条提交，显式事务与其语句放在同一次运行。Oracle DDL 会隐式提交，已提交的操作会保留。
- 支持表设计、重命名、清空、删除表或视图，以及数据网格编辑。复杂字段可通过 SQL 窗口处理。转储包含表和视图 DDL，也可流式导出表数据。恢复前需准备同名 Schema 和外部依赖；完整实例级备份使用 Oracle Data Pump。
- 同步可以将一个源 Schema 的普通表复制到目标账号所属的已有空 Schema。支持常用字符、数字、日期、时间戳、RAW、CLOB 和 BLOB 数据，保留主键及延后建立的外键。视图跳过，依赖范围外的外键、外部表、分区表和需另行迁移的复杂类型会在检查时被拒绝。数据按表提交，DDL 和已经提交的表数据会保留。
- 监控包括登录用户的表、视图、索引和无效对象。有 `V$SESSION` 读取权限时显示当前容器的用户会话。AI SQL 使用 Oracle 方言，Agent 支持发现连接、读取元数据和查询，写入沿用逐次确认。

## MariaDB 11.4

MariaDB 为独立 mariadb 类型，前端 src/databases/mariadb、后端 internal/mariadb 分别组装适配器。底层显式复用 MySQL 线协议、反引号及数据库即 schema 的层级；补全使用 MariaSQL。支持连接测试/保存、库表/视图/字段/索引、SQL 窗口 DDL/DML、USE、多结果、INSERT/DELETE/REPLACE RETURNING、表设计、主键数据编辑及 SQL 转储。

字段默认值按 MariaDB 的带引号字面值规则解析；复杂表达式及含反斜线的默认字面值保持锁定，避免改变未知 SQL mode 下的定义。排序规则从 COLLATION_CHARACTER_SET_APPLICABILITY 读取完整名称与字符集映射，保留 UCA1400 并优先 utf8mb4；表列表不把 SEQUENCE 冒充普通表。/*! 与 /*M! 在脚本中保留，默认只读 API 拒绝它们；显式写入仍由服务器执行。

转储范围为表/视图，不包含独立序列、系统版本历史、例程、触发器、事件和授权；系统版本表带数据转储明确提示使用 mariadb-dump。单表流式读取有界内存并支持取消，跨表不保证一致快照。

Docker 使用 -p 3307:3306 时，新建连接选择 MariaDB，主机填 127.0.0.1，端口填 3307，账号使用授权账号；打开后可选择容器初始化的 testdb。产品默认端口仍为 3306，映射端口由连接配置决定。密码不进入源码、文档或工作区快照。

## Redis

在新建连接中选择 Redis 和连接模式。查询页右上方的键详情、命令行、发布订阅按钮前显示当前模式。用户名可留空以使用 default 用户，连接可启用证书验证的 TLS。

- **单机**填写 Redis 主机及端口，默认 6379，逻辑库默认 0。以前保存但缺少模式字段的 Redis 连接按单机加载。
- **哨兵**填写首个哨兵地址，默认端口 26379，并填写被监控的主节点名称。其他哨兵可逐行填写 `主机:端口`。Redis 数据节点凭据与哨兵凭据分开，密码留空时编辑可沿用已保存值。客户端通过哨兵发现当前主节点，后续请求可以跟随主从切换。
- **集群**填写首个种子节点及可选的其他节点，默认端口 6379。查询和键操作按槽路由，逻辑库固定为 DB 0。键浏览逐个主分片扫描。跨槽的多键命令按 Redis 的规则返回错误。集群监控标明本次采样的主节点，其指标为该节点的统计。

客户端需要能访问哨兵或集群公布的节点地址。启用 TLS 时这些地址也须通过主机名验证。双击连接展开或收起逻辑库。双击逻辑库或右键选择「打开查询」可进入查询标签。命令编辑器支持 SQL 文件导入导出、选区执行、逐行运行、补全和格式化。终端按 Enter 执行，方向键翻历史，输入 `clear` 清屏。单机和哨兵可使用 `SELECT` 切库。键详情支持新增字符串键、编辑可完整预览的 UTF-8 键值、修改 TTL、重命名、复制和删除。TTL 以秒为单位，0 表示永久，过期的键自动从当前列表移除。

键列表提供「扫描下一批」或「连续扫描」。连续扫描可随时停止，已读的键和当前游标会保留，可以继续扫描。集群主节点变化导致游标失效时，键列表会保留已读的键，并提供「重新扫描」从头扫描。常用命令和键读取复用连接；终端的连接或请求错误可从对应的失败回执中展开查看。

## GreptimeDB

新建连接选择 GreptimeDB。Docker 使用 `-p 127.0.0.1:4002:4002` 映射时，主机填 `127.0.0.1`，端口填 `4002`，维护库默认 `public`。采用其他端口映射时填宿主机端口。未启用鉴权时用户名和密码可留空，启用后填写配置的账号。容器的 MySQL 监听地址须允许容器外访问。见 [GreptimeDB Docker 文档](https://docs.greptime.com/getting-started/installation/greptimedb-standalone/)。

支持数据库、表、视图、字段和索引浏览，保留 `TIME INDEX`，提供数据预览、CSV、原始 DDL、SQL 和 TQL 执行。查询结构可显示视图列名和类型。工作台可用 `USE "库名"` 切换数据库，后续语句使用切换后的库。建表与写入通过 SQL 编辑器完成。图形化表设计、网格行编辑、SQL 转储和 Agent 数据库工具暂未接入。

## SQL 转储

导出开始时固定连接、数据库、Schema 和对象范围，先按引擎收集结构，再通过专用 SSE 接口逐批读取表数据并写入文件。视图只导出结构。MySQL/MariaDB 先创建占位视图再恢复定义，PostgreSQL 和 Oracle 按依赖顺序恢复转储内的视图。关闭所属连接或数据库会取消导出。

每个对象完成后复核 DDL，结构变化或数据列不匹配时停止。后端独立限制为 2 路并发、30 分钟和单行 8 MiB，事件及错误约定见 [流式转储 API](API.md#流式转储)。原生文件流只在全部成功后提交，失败或取消中止写入；兼容下载模式缓存上限 256 MiB，超限不下载部分文件，触发下载也不代表已核验落盘。

转储保留已适配的精确值、二进制、NULL、生成列、自增和自有序列定义，以及字符集、Schema 和延后外键等必要结构。它不提供跨表一致性快照，不包含完整的例程、触发器、事件、授权及外部依赖。完整备份应使用对应数据库的原生工具。

PostgreSQL／PolarDB 的库和 Schema 转储只创建用户 Schema，跳过扩展自身管理的表和视图，例如 PolarDB 默认附带的任务调度表，并在日志报告跳过数量。恢复需要预先安装所依赖的扩展。

MySQL 数据库转储包含原库名。恢复到空实例时可在查询页清空当前库选择，再执行完整脚本，由脚本建库和切库。已有同名表会报错并停止。编辑器导入上限为 16 MiB，较大的转储可用 MySQL 客户端执行。

实现见 [转储编排](../sql-studio-frontend/src/pages/workspace/hooks/useDataExport/README.md)与[文件写入](../sql-studio-frontend/src/utils/exportWriter/README.md)。
