# SQL Studio 多类型语句与压力测试报告

- 日期：2026-11-20
- 代码基线：`99dd0cb`（包含修复提交 `a7170c9`）
- 范围：多类型数据库语句执行、长 SQL/大批次、百万级数据、并发、取消、Redis 多数据结构与大键扫描
- 方式：独立后端 + 独立临时状态目录 + Docker 隔离数据库 + API/UI 双层验证；未修改源码

## 1. 测试环境

| 组件 | 版本 |
| --- | --- |
| MySQL | 8.4.10 |
| MariaDB | 11.4.13 |
| PostgreSQL | 16.16、17.12 |
| PolarDB PostgreSQL | 17.11.1.0 |
| Redis | 7.4.12 |
| 前端/后端 | 当前 commit 构建产物 / 独立实例 127.0.0.1:18089 |

所有测试库、schema、连接和容器均为临时对象，结束后已删除。

## 2. 多类型语句矩阵

### MySQL 8.4 / MariaDB 11.4

已验证成功：

- **DDL**：建库/表、主键、唯一键、外键、CHECK、ENUM、JSON 列、生成列、复合索引、全文索引、哈希分区表、视图、`CREATE OR REPLACE VIEW`、`CREATE TABLE LIKE`、`CREATE TABLE AS SELECT`、`ALTER TABLE ADD/MODIFY/DROP COLUMN`、`ADD/DROP INDEX`、`RENAME TABLE`、`TRUNCATE`。
- **DML**：INSERT、INSERT IGNORE、REPLACE、ON DUPLICATE KEY UPDATE、INSERT SELECT、多表 UPDATE、多表 DELETE、CTE SELECT、窗口函数、JSON 函数、ROLLUP。
- **存储程序**：单语句/多语句存储过程、函数、触发器（含 BEGIN…END 内部多条语句）、事件；MySQL 不支持 SEQUENCE（按预期报错），MariaDB SEQUENCE 正常。
- **事务**：`BEGIN / SAVEPOINT / ROLLBACK TO / COMMIT / ROLLBACK` 在同一批次会话中正确生效；提交行为 1 行、回滚行不存在。
- **临时表**：同一批次内创建/插入/查询成功；批次结束后其他请求不可见（符合会话隔离）。
- **预处理**：`PREPARE / EXECUTE / DEALLOCATE` 正常。
- **元数据/分析**：`SHOW TABLES`、`SHOW TRIGGERS`、`SHOW VARIABLES`、`SHOW PROCESSLIST`、`DESCRIBE`、`EXPLAIN`、MySQL `EXPLAIN ANALYZE`、`ANALYZE TABLE`。
- **错误类型**：唯一键、外键、CHECK（MySQL 8/MariaDB 强制执行）、NOT NULL、语法错误、未知表；错误均能停止后续语句。
- **MariaDB 专属**：`INSERT ... RETURNING`、`DELETE ... RETURNING`、`SEQUENCE` 通过；MySQL 对应语法按预期报错。

版本限制：

- MariaDB 不支持 `WITH ... UPDATE` 形式（语法错误）；MySQL 不支持 SEQUENCE。
- 单条 SQL 窗口对含内部半角分号的存储程序体存在分割限制：UI 会把 `CREATE PROCEDURE ... BEGIN SELECT 1; SELECT 2; END` 拆成 3 条，首条语法错误，后续 2 条未执行；而 API 批次将完整存储程序作为单条语句发送时可成功创建。详见第 4 节问题 1。

### PostgreSQL 16/17 与 PolarDB

已验证成功：

- **对象与 DDL**：ENUM、DOMAIN、IDENTITY、生成列、CHECK/UNIQUE/FK、表达式索引、部分索引、GIN 索引、`CREATE INDEX CONCURRENTLY`、`DROP INDEX CONCURRENTLY`、`ALTER TABLE`、`COMMENT ON`、`CREATE TABLE AS`、`CREATE TABLE (LIKE ...)`、视图、物化视图及 REFRESH、SEQUENCE、函数（SQL/PLpgSQL）、触发器、RANGE 分区（父表 + `PARTITION OF`）。
- **DML/高级查询**：INSERT RETURNING、ON CONFLICT DO UPDATE、MERGE（PG16+）、UPDATE FROM、DELETE USING、递归 CTE、LATERAL、GROUPING SETS、窗口帧、数组、范围类型、JSONB、全文检索、EXPLAIN ANALYZE、VACUUM。
- **高级特性**：DO 块、SET/SHOW、并发索引、分区裁剪（`tableoid::regclass` 验证分区命中）。
- **版本差异**：PG13 不支持 MERGE/JSON_TABLE/ANY_VALUE/pg_stat_io；PG16 支持 MERGE/ANY_VALUE/pg_stat_io；PG17 增加 JSON_TABLE；PolarDB 17 与 PG17 测试项一致。
- **错误类型**：FK、UNIQUE、ENUM 非法值、DOMAIN 约束、CHECK、NOT NULL、语法错误、未知表、除零，均按预期失败并停止。
- **事务/会话边界**：跨 HTTP 请求 `BEGIN → INSERT → ROLLBACK` 后数据仍存在（每语句独立连接）；临时表在下一请求不可见。属当前逐语句请求架构行为，使用事务脚本时需注意。
- **分区语法**：CREATE TABLE 内联分区定义不是 PostgreSQL 合法语法；父表 `PARTITION BY` + 独立 `PARTITION OF` 已验证通过。

### Redis 7.4

字符串、Hash、List、Set、ZSet、Stream、Bitmap、HyperLogLog、Geo、TTL/PERSIST、TYPE 均通过；`WRONGTYPE` 返回明确错误；`MULTI` 等需要独立会话的命令被友好拒绝；`EVAL`、`FUNCTION LIST` 正常。

## 3. 压力测试结果

### 数据量与批处理

| 引擎 | 场景 | 结果 |
| --- | --- | --- |
| MySQL 8.4 | 1,000,000 行 INSERT SELECT | 12,843 ms |
| MySQL 8.4 | 建索引 / 聚合 / 索引点查 | 4,631 / 74 / 33 ms |
| MySQL 8.4 | 10 万行 UPDATE / DELETE | 1,496 / 2,618 ms |
| MySQL 8.4 | 1000 行 × 1KB 结果 | 220 ms |
| MariaDB 11.4 | 50 万行（10 万种子 + 4×10 万复制） | 种子 4,040 ms，后续 341–416 ms/10 万 |
| MariaDB 11.4 | 建索引 / 10 万 UPDATE / 10 万 DELETE | 902 / 2,119 / 325 ms |
| PG 16 | 1,000,000 行 CREATE TABLE AS | 1,774 ms |
| PG 16 | 建索引 / 聚合 / 10 万 UPDATE / 10 万 DELETE | 404 / 124 / 682 / 254 ms |
| PG 17 | 30 万行建表 / 索引 / UPDATE / DELETE | 498 / 115 / 741 / 110 ms |
| PolarDB 17 | 30 万行建表 / 索引 / UPDATE / DELETE | 474 / 360 / 1,311 / 500 ms |

删除后计数：MySQL 90 万、MariaDB 40 万、PG16 90 万、PG17/PolarDB 20 万，均符合预期。

### 批量写入性能（重点）

| 方式 | 200 行耗时 |
| --- | --- |
| MySQL 逐条 autocommit INSERT（批次） | 15,831 ms |
| MySQL `BEGIN + 200 INSERT + COMMIT` 同批次 | 178 ms |
| MySQL 单条多行 INSERT（200 行） | 128 ms |

- 5,000 条逐条 autocommit INSERT 批次耗时 **433,211 ms（约 7.2 分钟）**，最终 5000/5000 成功。
- 性能差异来自每条 INSERT 独立提交的 fsync 放大，而非批次协议本身；同批次显式事务可把 200 行写入降到 178ms。
- PostgreSQL 200 条逐语句 INSERT 共 2,954 ms（约 15ms/条），单条 `INSERT ... SELECT generate_series` 39ms。

### 并发、吞吐与取消

| 场景 | MySQL | PostgreSQL |
| --- | --- | --- |
| 5 个并发 SLEEP(3) | 4×200 + 1×429，总 3,004 ms | 4×200 + 1×429，总 3,088 ms |
| 300 条简单查询顺序执行 | 4,383 ms，p50 15ms，p95 17ms | 4,380 ms，p50 15ms，p95 18ms |
| 失败/错误请求 | 0 | 0 |

- 并发上限为 4 个查询槽，第 5 个返回 429；槽位在查询结束后释放。
- 500 条 `SLEEP(0.02)` 长批次在约 757ms 时取消，仅收到 1 条语句；随后 `SELECT 7` 成功，运行锁释放。

### Redis 压力

| 场景 | 结果 |
| --- | --- |
| EVAL 批量写入 50,000 键 | 87 ms |
| Hash / ZSet / List / Stream 各 10,000 元素 | 全部成功 |
| 全量 SCAN `stress:*` | 508 页、51,005 键、7,130 ms |
| 1,000 条独立 SET 命令 | 14,205 ms（约 14ms/条） |
| 60KB VALUE SET/GET | 成功，GET 返回 61,440 字节，未截断 |

## 4. 问题与限制

1. **中：SQL 窗口不支持含内部半角分号的存储程序。** UI 分句器会把 `CREATE PROCEDURE ... BEGIN SELECT 1; SELECT 2; END` 拆开，导致首条语法错误并停止；API 批次以完整单条语句发送时可成功。触发器 BEGIN…END 同理。
2. **中：大批量逐条写入性能风险。** 5,000 条 autocommit INSERT 批次耗时 433s；用户需自行在脚本中加 `BEGIN/COMMIT` 或改用单条多行 INSERT；UI 不会自动包裹事务。
3. **中：PostgreSQL/PolarDB 跨请求事务和临时表不共享。** 逐语句请求架构下，`BEGIN → INSERT → ROLLBACK` 的 INSERT 仍会提交；临时表下一请求不可见。执行事务脚本时应使用单条语句能力或理解该边界。
4. **低：简单查询固定开销约 15ms。** 本机顺序 300 次 `SELECT 1` 约 4.4s（约 68 qps），MySQL/PG 接近；主要来自每请求连接/HTTP 开销。
5. **已知遗留（同日复测）：** MariaDB 超过 `max_allowed_packet` 时约 4/5 仍显示 `driver: bad connection`；单条 >1MiB 语句仍不可执行（提示已本地化）；9MB 单结果整行丢弃（truncated=true、rowCount=0）；`pnpm format:check` 仍报 108 个文件；语句错误详情需手动展开。
6. **版本限制：** MySQL 不支持 SEQUENCE/RETURNING；MariaDB 不支持 `WITH ... UPDATE`；PG13 不支持 MERGE/JSON_TABLE/ANY_VALUE/pg_stat_io；上述均在对应版本明确报错。

## 5. 自动化测试（同日复测，代码未再变更）

- 前端真实 SQL 窗口集成：52/52 通过。
- 前端 Node 测试：220 通过、3 跳过、0 失败；lint 39 项通过。
- 后端 MySQL/PostgreSQL 集成：PASS。
- `go test ./...`、`go vet ./...`、`go build ./...`：通过。
- 前端 `pnpm build`：成功。
- `pnpm format:check`：失败，108 个既有文件待格式化。

## 6. 清理核验

- 测试库/schema：MySQL `st_mysql`、MariaDB `st_maria`、PG16/17/PolarDB `st_pg*` 已删除。
- Redis 测试数据已 FLUSHALL；连接列表 0，分组仅剩“默认分组”。
- 6 个压力测试容器已删除；全流程 E2E 轮次的 4 个容器（MySQL/MariaDB/PostgreSQL/Redis）、Agent 深度轮次的 3 个容器（MySQL/PostgreSQL/Redis）、对应 `e2e_*`/`agent_deep` 库与 schema、连接、Agent 会话和临时目录同样已清理。
- 独立后端已停止；18089 及全部测试端口无监听；连接列表 0，仅剩默认分组。
- 除本报告外，仓库无源码改动。

## 7. 全流程 E2E 回归（补充）

最新提交下再次走完工作台主流程：

- **连接树/分组**：5 个连接与分组正常展示；MySQL/MariaDB/PostgreSQL/Redis 均可选。
- **MySQL 窗口**：精确值（BIGINT/DECIMAL/NULL/空串/重复列）、选区 Ctrl+Enter 仅执行选中语句、3 条多语句三结果、失败停止“后续 1 条未执行”、SLEEP 取消显示“执行已取消”且历史 `cancelled=true`、取消后可继续查询。
- **表数据页**：双击 sample 打开数据；单元格 0.0000→0.3333 保存成功并落库，随后已还原；刷新后页签、草稿、结果恢复且未自动重跑。
- **PostgreSQL**：INSERT/DELETE RETURNING、错误停止与后续未执行。
- **MariaDB**：INSERT/DELETE RETURNING、中文值、3 结果。
- **Redis**：SET/GET/DEL 多命令、中文值、3 结果。
- **Agent（DeepSeek）**：
  - 只读模式能发现多个连接；对“两个连接都包含 e2e_mysql”主动要求澄清，指定 MySQL84 后完成表结构/数据/行数/NULL 与空串说明。
  - 完全访问模式：CREATE TABLE、INSERT 各弹出独立确认卡，确认后真实落库并回读一致。
  - 取消确认：显示“用户取消本次操作，未执行SQL”，无自动重试。
  - 删除请求：拒绝执行 DELETE/DROP，仅给出命令与风险说明，表数据保持原状。
- **监控**：MySQL 实例页显示版本、连接、语句趋势、InnoDB/缓冲池等指标。
- **同步**：同步页可打开；由于隐藏浏览器下拉控件定位受限，改用同一后端同步接口完成 MySQL→新库同步：检查通过，新库创建，2 张表/4 行数据复制成功（含 Agent 新建表）。
- **设置**：AI 模型添加/持久化通过；Agent 页面需单独选中模型后可用（全局默认模型未自动带入 Agent 模型选择，见下）。

本轮观察：

- Agent 仅配置全局模型后，助手页仍显示“请选择模型”，需通过 Agent 设置/模型选择绑定 `configId`；建议确认是否应自动继承全局默认模型。
- 同步页在隐藏内置浏览器中出现源/目标下拉错位，属合成事件/无可见表面限制；同后端 API 同步通过，未按产品缺陷计。
- 内置浏览器仍无可见表面，无法真实指针输入；错误详情需手动展开、动画冻结等问题仍属环境限制。

## 8. 跨版本 SQL 兼容性（补充）

同一 SQL 在 MySQL 5.7.44 / 8.0.46 / 8.4.10、MariaDB 10.11.19 / 11.4.13、PostgreSQL 13.23 / 16.16 / 17.12 / PolarDB 17.11.1.0、Redis 6.2.24 / 7.4.12 上逐一执行；迁移脚本按批次执行并记录停止点。以下差异均来自数据库版本能力，不是 SQL Studio 路由或结果错误。

### MySQL / MariaDB 兼容矩阵

| 特性 | MySQL 5.7 | MySQL 8.0/8.4 | MariaDB 10.11/11.4 |
| --- | --- | --- | --- |
| CTE / 递归 CTE / 窗口函数 | 不支持 | 支持 | 支持 |
| JSON_TABLE | 不支持 | 支持 | 支持 |
| VALUES 表构造 | 不支持 | 支持（ROW 语法） | 支持（无列别名写法） |
| CHECK 约束 | 接受但忽略 | 强制执行 | 强制执行 |
| 删除 CHECK | 不支持 | `DROP CHECK` | `DROP CONSTRAINT` |
| 生成列 | 支持 | 支持 | 支持 |
| 函数/表达式索引 | 不支持 | 支持 | 不支持 |
| 不可见索引 | 不支持 | `INVISIBLE` | `IGNORED` |
| RENAME COLUMN | 不支持 | 支持 | 支持 |
| ADD COLUMN IF NOT EXISTS | 不支持 | 不支持 | 支持（`ADD COLUMN IF NOT EXISTS v INT`） |
| INSERT ... RETURNING | 不支持 | 不支持 | 支持 |
| SEQUENCE | 不支持 | 不支持 | 支持 |
| UPSERT 别名（`AS new`） | 不支持 | 支持 | 不支持 |
| SKIP LOCKED | 不支持 | 支持 | 支持 |
| GROUP BY 非聚合列 | 严格报错 | 严格报错 | 宽松通过 |
| 0000-00-00 日期 | 拒绝 | 拒绝 | 接受 |
| utf8 列存 4 字节 emoji | 拒绝 | 拒绝 | 拒绝（需 utf8mb4） |
| JSON 类型 | 支持 | 支持 | 支持（别名 LONGTEXT） |
| CTE UPDATE | 不支持 | 支持，但 `c.status` 直引报错；需 `IN (SELECT ...)` | 语法不支持 |
| utf8mb4_0900_ai_ci | 不支持 | 支持 | 10.11 不支持；11.4 支持 |

迁移脚本实测：

- MySQL 8 风格建表（0900 排序规则 + DESC 索引 + RENAME COLUMN）：MySQL 8.0/8.4 全部通过；MariaDB 11.4 通过；MySQL 5.7 与 MariaDB 10.11 在第一条 CREATE 即因未知排序规则停止，后续语句未执行。
- MariaDB RETURNING/SEQUENCE 脚本：MariaDB 通过；MySQL 8.0/8.4/5.7 在 INSERT RETURNING 停止，后续未执行。
- MySQL 5.7 老脚本（`ON DUPLICATE KEY UPDATE ... VALUES()`、`SQL_CALC_FOUND_ROWS`/`FOUND_ROWS`）：在 5.7、8.0、8.4、MariaDB 10.11/11.4 上均通过（新版本仍有弃用风险）。

### PostgreSQL / PolarDB 兼容矩阵

| 特性 | PG 13 | PG 16 | PG 17 / PolarDB 17 |
| --- | --- | --- | --- |
| CTE / 窗口 / JSONB / RETURNING / IDENTITY / 分区 / 并发索引 / VACUUM | 支持 | 支持 | 支持 |
| MERGE | 不支持 | 支持 | 支持 |
| ANY_VALUE / pg_stat_io / regexp_count | 不支持 | 支持 | 支持 |
| UNIQUE NULLS NOT DISTINCT | 不支持 | 支持 | 支持 |
| JSONB 下标访问 | 不支持 | 支持 | 支持 |
| SQL/JSON `json_object` | 不支持 | 支持 | 支持 |
| JSON_TABLE | 不支持 | 不支持 | 支持 |

同一 PG17 功能脚本从 PG17 降到 PG13 会逐项失败（MERGE、ANY_VALUE、pg_stat_io、JSONB 下标、JSON_OBJECT、JSON_TABLE）；PG16 可执行除 JSON_TABLE 外的大部分新语法。

### Redis 版本兼容

- 6.2 与 7.4 均支持：GETDEL、GETEX、COPY、ACL LIST、Streams。
- 仅 7.4 支持：EXPIRETIME、FUNCTION、SINTERCARD、LMPOP、ZMPOP、`SET ... NX GET`；在 6.2 上分别返回 unknown command 或语法错误。
- `OBJECT FREQ` 在默认 maxmemory-policy 下两个版本均返回“未启用 LFU”错误，属配置前提而非版本差异。

### 跨引擎方言差异

- 反引号标识符：MySQL/MariaDB 通过，PostgreSQL 语法错误；双引号别名均通过。
- `'a'||'b'`：MySQL/MariaDB 解释为逻辑 OR，结果为 0；PostgreSQL 返回 `ab`。
- 布尔值：MySQL/MariaDB 返回 1/0，PostgreSQL 返回 true/false。
- `LIMIT`、`CONCAT()`、双引号别名在三者均可用。
- 数据保真：BIGINT 9007199254740993、DECIMAL 尾零、NULL、空串、中文在各版本结果一致，未发现跨版本结果错位。

**兼容性风险提示：**

1. MariaDB → MySQL 迁移需改写 `ADD COLUMN IF NOT EXISTS`、RETURNING、SEQUENCE、`IGNORED` 索引、`DROP CONSTRAINT`；MySQL → MariaDB 需改写函数索引、`INVISIBLE`、UPSERT 别名。
2. MySQL 5.7 → 8.x 后 CHECK 开始强制执行，历史脏数据可能被拒绝；`VALUES()` 与 `SQL_CALC_FOUND_ROWS` 已弃用。
3. 4 字节 emoji 在所有测试的 `utf8`（utf8mb3）列均失败，必须使用 utf8mb4。
4. MySQL 默认 ONLY_FULL_GROUP_BY，MariaDB 默认宽松；从 MariaDB 迁到 MySQL 的 GROUP BY 查询可能报错。
5. PG13 是多项新语法的兼容下限；降级到 PG13 前需移除 MERGE/ANY_VALUE/pg_stat_io/JSONB 下标/JSON_OBJECT 等。
6. Redis 7.x 脚本不能在 6.2 上执行 EXPIRETIME/FUNCTION/LMPOP/ZMPOP/SINTERCARD 等命令。

兼容性测试的 11 个容器、全部 `cmp_*` 库/schema、连接和临时目录已清理。

## 9. AI 助手深度测试

环境：MySQL 8.4（`agent_deep` 库，150 行样本、删除靶表、counter、存储过程）、PostgreSQL 16（对应 schema）、Redis 7.4；模型 DeepSeek-V4.1-Flash；独立后端、独立会话。除特别说明外为 Agent API/SSE 层深度测试，UI 确认卡与模式切换在“全流程 E2E”章节已覆盖。

### 通过项

- **工具链与分页**：一次查询触发 list_connections、list_databases、use_database、list_tables、describe_table、query_readonly；单次工具最多 100 行，Agent 自动分页 100+50 取全 150 行，并正确说明未截断、总数 150；跨轮追问能引用上一轮结果。
- **只读安全**：DELETE/DROP/TRUNCATE/REPLACE、存储过程、动态 SQL、UPDATE 均被拒绝；`SELECT 1; DELETE ...` 仅执行 SELECT，DELETE 未执行；MySQL 与 PG 靶表均保持 3 行。
- **写入确认**：CREATE/INSERT/UPDATE 分别弹出确认，确认后真实落库（表、行、counter 均核对）；24 路并发确认只有 1 个返回 200，其余 23 个 400，`UPDATE v=v+1` 最终只加 1。
- **取消/断线**：取消确认后无写入、显示停止；等待确认时断开 SSE，迟到的确认请求返回 400 且无写入；取消运行中的查询后会话恢复空闲，后续 SELECT 7 成功。
- **限额确认**：70KiB 输入触发 `continue_confirmation(kind=input)`，拒绝后停止；39.2KiB 工具结果触发 `kind=result` 确认，拒绝后不发送模型；260KiB 输入被拒绝。
- **故障恢复**：查询不存在表返回工具警告，模型给出解释，下一轮查询正常；写失败（CHECK 约束）后会话继续，后续只读查询正常。
- **会话与设置**：重命名成功，空白/81 字符返回 400；删除空闲会话成功；过期 revision 返回 409；忙碌会话删除返回 400“请先停止当前请求”；非法 configId 返回 400。
- **并发名额**：3 个会话同时发起重查询，2 个正常执行，第 3 个收到 `error: Agent 忙，请稍后重试` 和 done，未崩溃、未静默成功。

### 问题与观察

1. **中：写入失败丢失具体数据库错误。** CHECK 约束拒绝 INSERT 时，工具结果只返回“数据库操作失败，请检查连接状态、SQL、对象及数据库权限”，没有暴露 `CHECK constraint violated` 细节；模型只能猜测原因。建议将可安全展示的数据库错误传给工具结果/模型（至少包含约束名或 SQLSTATE）。
2. **低：256KiB 超限文案不准确。** 非空长消息被拒绝时提示“消息不能为空且最多 256 KiB”，容易让用户误以为消息为空；建议拆分空消息与超限文案。
3. **观察：Agent 会拒绝 SLEEP/等待类查询。** 并发测试用 `SELECT SLEEP(5)` 时被策略禁止，属于安全/资源保护行为，但用户可能误以为连接或权限问题；建议在提示中明确“等待/副作用函数不可执行”。
4. **观察：多语句请求会被拆解。** 写模式下 `INSERT; DELETE` 只对 INSERT 单独确认并执行，DELETE 拒绝，不会作为一个多语句工具调用发送；安全，但不是整批原子语义。
5. **观察：100 行限制是单次工具上限，不是回答上限。** Agent 可通过多次分页返回超过 100 行的汇总/数据；界面需明确这是多次只读查询。
6. **观察：** 同轮三开时第 3 个会话以 `error + done` 结束，错误文案依赖前端展示；需确保 Agent 页能把该 error 呈现为可见提示，而不是空回答。

## 10. Codex 修复复测（提交 793cc70）

针对报告中问题逐项复测结果：

| 修复项 | 复测结果 |
| --- | --- |
| 单条长 SQL 上限 | UI/API 执行 2MB 单语句成功（1 次 `/query`）；33MB 返回本地化 413（32 MiB 上限） |
| PG 同会话批次 | UI 4 条 `BEGIN/INSERT/ROLLBACK/SELECT` 仅 1 次 `/query-batch`，回滚后计数 0；批次内临时表可见、批次后不可见；单请求 `BEGIN` 明确返回“请在同一个 SQL 批次中执行 PostgreSQL 事务及其语句” |
| MySQL DELIMITER 存储程序 | UI `DELIMITER // CREATE PROCEDURE … BEGIN SELECT 42; END//` 成功，`fv_proc` 已创建；右键“作为单条 SQL 运行”成功创建 `fv_single` |
| 事务中运行 INSERT | 右键菜单生成 `START TRANSACTION / INSERT / INSERT / COMMIT`，2 行落库，耗时约 119ms |
| 超大行结果 | 9MB 单值返回 `truncatedBy=oversized-row`，提供 512 字节只读预览；UI 显示“首行超过 8 MiB，仅提供只读预览。” |
| MariaDB packet 错误 | 20MB 语句连续 3 次均返回归一化 `max_allowed_packet` 错误，不再出现 `driver: bad connection` |
| Agent 约束错误 | CHECK 约束拒绝写入时工具结果返回“数据库拒绝操作：CHECK 约束校验失败”，模型能准确总结；未插入数据 |
| Agent 256KiB 文案 | 260KiB 消息返回“消息超过 256 KiB，请分段发送”（不再包含“不能为空”） |
| Redis 键扫描 | 点击一次“扫描下一批”由 102 个键增至 1109 个键（每批 10 页），不再每次仅 100 个 |
| 自动化 | 前端真实窗口集成 53/53；Node 测试 222 通过/3 跳过；lint 39 通过；后端集成通过；`pnpm build` 成功 |

### 793cc70 阻塞修复复测

- **前端构建/lint 已修复**：重复翻译键 `结果已达行数或大小上限，请收窄查询范围。` 已删除；`pnpm build`、`pnpm lint` 均通过（lint 39 项）。
- **后端架构测试已修复**：Agent 错误分类改为模型层 `QueryError`，`app/agent.go` 不再直接依赖 MySQL 驱动；`go test -count=1 ./...` 全部通过，`TestInternalDependencyDirection` 通过。
- **运行期回归**：重新验证 2MB 单语句、PG 批次事务回滚、9MB 行预览、Agent CHECK 错误文案、260KiB 文案，全部通过；前端真实窗口集成 53/53，后端真实 MySQL/PG 集成 PASS。
- **仍存在**：`pnpm format:check` 仍有 105 个文件不符合格式（非本次功能修复范围）。

两轮复测共 7 个容器、`fv_*` 库/schema、连接和临时目录均已清理；验证过程未修改源码。

## 11. SQL Studio 1.1.0 新功能验证

环境：MySQL 8.4、Redis 7.4 单主+哨兵、Redis 7.4 三主分片集群；Chrome 无头 CDP（内置浏览器无可见表面）。

### 1. Redis 哨兵与集群

- 新建连接表单可选 **单机 / 哨兵 / 集群**；哨兵显示哨兵主机、其他哨兵和主节点名称，集群显示种子节点列表。
- 哨兵：通过 `127.0.0.1:26379` 发现主节点 `mymaster`，查询 `GET sentinel:key` 返回 `hello`，工具栏显示“哨兵”。
- 集群：逻辑库固定为 DB 0，`GET cluster:key:1` 返回 `1`，工具栏显示“集群”。
- 集群键浏览逐个主分片扫描：首次 68 个键，点击一次“扫描下一批”后为 200 个键。
- 集群监控标明采样节点 `127.0.0.1:7000 / master`，指标为该节点数据，并显示“集群”标签。
- 未覆盖：哨兵主从切换、哨兵/集群 ACL 与 TLS、集群跨槽多键命令。

### 2. 查询收藏

- 工具栏“收藏查询”支持收藏选区、整段草稿；执行历史行也可收藏。
- 收藏抽屉支持搜索、重命名、删除、打开；打开收藏会新建页签并载入 SQL，**不自动执行**（打开前后 query 请求增量为 0）。
- 收藏持久化在 `query-favorites` 状态分区。

### 3. 结果导出 CSV / Excel / JSON

- 1500 行查询返回 1000 行并提示“结果已达行数上限”，导出菜单提供 CSV/Excel/JSON 及“导出已加载结果 / 导出选中”。
- CSV：1001 行（含表头）。
- Excel：`查询结果` 工作表 1001 行；原结果截断时附加 `导出说明` 工作表，文案“原查询结果已截断，文件仅包含已返回的数据。”
- JSON：1000 行，`truncated=true`、`truncatedBy=row-limit`；选中一行后导出 JSON 为 1 行。
- 网络下载在无头 Chrome 未落盘，测试通过拦截 Blob 校验内容；未单独测试 Excel/CSV 的选中行导出（与 JSON 共用 rows(scope) 路径）。

### 4. 执行错误就地显示

- SQL 查询不存在表：错误 `Error 1146 ... doesn't exist` 直接显示在“消息”页签，无顶部错误条。
- Redis 非法命令：`ERR unknown command` 直接显示在消息/命令输出，无顶部错误条。
- 未单独复测连接失败/请求超限的顶部错误路径。

### 5. 更新下载进度

- 通过桌面桥接模拟 `available + pending=download + 42%`，设置“关于软件”显示圆形 42% 进度环，界面不再显示速度与文件大小；状态文案“正在下载更新”。
- 切换为 `downloaded` 后进度环让位给“重启并安装”。
- Electron 更新模块 12 项测试全部通过（清单校验、进度广播、失败保留、重复检查、安全错误码、preload 订阅）。
- 未执行真实 GitHub 下载与安装（通过 mock 状态验证 UI、通过单测验证主进程协议）。

### 自动化

- 前端 `pnpm build` 成功；lint 39 项通过；Node 测试 223 通过/3 跳过；`format:check` 仍有 100 个既有文件未格式化。
- 后端 `go test ./...`、`go vet ./...`、`go build ./...` 全部通过。
- Electron `tests/updates.test.mjs` 12/12 通过。

第 11 节验证结束后清理了 3 个容器（MySQL、Redis 哨兵、Redis 集群）、`v110` 库、Redis 数据、连接和临时目录；Chrome 进程与测试端口已关闭。第 12 节重新搭建的 Redis 压测环境也已单独清理。

## 12. Redis 哨兵/集群压力与故障转移（2026-11-20 补充）

环境：Redis 7.4.12；哨兵 26379 管理主 16379 / 从 16380（主节点名 `mymaster`）；集群 7000–7005 三主三从。独立实例 `127.0.0.1:18089`；压测通过真实 HTTP 接口执行，交互与结果核验主要用内置浏览器。

### 1. 常规压力

- 单机/哨兵/集群各顺序执行 300 次 `GET`：单模式约 4.3s，p50 15ms，0 失败。
- 每模式 100 并发：全部 HTTP 200；单模式完成约 50/133/110ms（单机/哨兵/集群）。
- 30 并发 60KB value 的 `SET/GET`：全部成功，读取长度 61440 字节。
- 集群跨槽 `MSET` 返回 400 `CROSSSLOT Keys in request don't hash to the same slot`（预期行为）。
- 集群 API 键扫描：204 页、20,180 键、2997ms；内置浏览器键浏览 2 万键耗时 71.85s，需点击 20 次“扫描下一批”（每批约 1000 键），属可用但偏慢的交互。
- 内置浏览器在集群窗口连续执行 400 条命令：24.2s 完成，返回结果正常。
- 后台负载约 102 命令/秒时，集群监控正常采样节点 `127.0.0.1:7001`。

### 2. 故障转移

哨兵：

- 20 个并发 worker 持续 `GET`，2.5s 时停止主节点 16379。
- 哨兵将 16380 提升为主；期间 3257 次请求中 2117 次失败（切换窗口叠加 Windows 临时端口耗尽）。
- 约 25s 后 `GET/SET/GET` 恢复；内置浏览器查询 `GET sentinel:before` 返回 `failover-value`。

集群：

- 8 个并发 worker，2s 时停止主节点 7000。
- 7003 接管 0–5460 槽，`cluster_state:ok`；916 次请求中 293 次失败。
- 约 28s 后 `GET/SET stress:key:3` 返回 `after-failover`。

### 3. 发现

- 故障切换期间失败集中在切换瞬间与客户端重连风暴，切换完成后数据未丢失，哨兵与集群最终均恢复。
- 后端 Redis 请求按命令创建客户端（`PoolSize=1`、`MaxRetries=-1`）。在 Windows 上，故障转移叠加高并发会快速消耗临时端口，出现 `wsarecv ... forcibly closed`、`Only one usage of each socket address` 等错误，恢复时间约 25–28s。建议评估连接复用或重试退避以降低端口压力；本次记为压测发现，不作为功能失败。
- 切换后原主 16379 未自动恢复；直接指向该端口的“单机”连接保持不可用（复测 805/805 失败），而哨兵 668/668、集群 640/640 成功。该差异由拓扑决定，不是模式缺陷。
- 集群 UI 键浏览单次约 1000 键、2 万键需 20 次手动点击，且耗时 71.85s；功能可用，但在大数据量下交互成本较高。

本轮清理：删除 3 个 Redis 测试连接；停止压测用 Chrome 与独立前后端进程；删除容器 `sqldesk-rs-sentinel`、`sqldesk-rs-cluster` 和临时脚本目录。

## 13. 异常中断与恢复（2026-11-20 补充）

环境：MySQL 8.4.10（13306）、PostgreSQL 16（15432）、Redis 7.4.12（16381），独立后端 `127.0.0.1:18089`；页面操作使用内置浏览器。

### 1. 连接突然不可用与恢复

- MySQL、PostgreSQL、Redis 分别停止容器后：查询在 3–28ms 内返回连接失败（`actively refused it`），顶部横幅显示原因，结果区显示“语句 1 执行失败”；应用、其他连接与其他查询不受影响。
- 重启容器后直接重试即可成功（MySQL 8.4.10 / PostgreSQL 16 / Redis 7.4.12），无需重建连接或重启应用；顶部横幅随成功查询消失。

### 2. 执行中强制终止

- MySQL：`SELECT SLEEP(20)` 执行 2s 后 `docker kill`，1.07s 返回 400 `invalid connection`；重启后查询成功。
- PostgreSQL：`SELECT pg_sleep(20)` 执行 2s 后 kill，1.07s 返回 400 `unexpected EOF`；重启后恢复。
- Redis：`BLPOP ... 0` 阻塞中 kill，1.10s 返回 400 `EOF`；重启后 `GET abn:key` 成功。
- 批量：`query-batch` 第一条 `SLEEP(10)` 中断后流式返回 index 0 错误 `invalid connection` 和 done，第二条未执行；重启后恢复。

### 3. 数据库卡死：暂停、超时与取消

- `docker pause` 2s 后恢复：`SELECT SLEEP(6)` 最终成功（总耗时约 6.0s），连接可继续使用。
- 暂停期间点击“取消执行”：页面显示“语句 1 执行已取消 2075 ms”，恢复容器后取消查询未残留（processlist 无 `SELECT SLEEP%`）。
- 暂停至 30s：请求在 30003ms 返回 `context deadline exceeded`，无残留连接；恢复容器后新查询成功。
- `docker network disconnect` 模拟网络分区（端口仍映射）：查询不会立即失败，而是挂起并在 30s 返回 `context deadline exceeded`；重新连接网络后查询恢复（首次约 2.4s）。
- 容器 `stop` 会等待正在执行的语句结束（`SLEEP(20)` 最终 6.2s 成功返回），因此“突然中断”需用 `kill` 或断网模拟。

### 4. 连接测试与监控

- MySQL 停机时“编辑连接 → 测试连接”返回“连接失败”并附 `actively refused it`；恢复后显示“连接成功：8.4.10”。
- Redis 停机时监控页显示顶部连接错误，指标区为空；重启后刷新恢复实例概览（v7.4.12、运行时间 1s、键总数 2）。

### 5. 本轮发现

- **连接级错误仍走顶部红色横幅**：连接失败、`invalid connection`、`unexpected EOF`、`context deadline exceeded` 在结果区只显示“语句 1 执行失败 <耗时>”，具体原因仅在可关闭的顶部横幅；横幅关闭后消息页找不到原因。这与 1.1.0“执行错误就地显示”的 SQL 错误路径不一致，建议把连接级失败原因同步写入消息项。该问题已在提交 `4ea8522` 修复并复测，见第 14 节。
- 网络分区与容器停止表现不同：停止（端口拒绝）快速失败；断网/卡死会等待到 30s 超时，用户侧显示为长时间“执行中”。属 TCP/超时设计预期，现有“取消执行”可用。
- 取消与超时后数据库侧未发现残留查询；批量中断后第二条语句未执行。
- 本轮未重新发起 Agent 对话；Agent 的数据库工具失败语义已由第 9 节覆盖。

本轮清理：删除 3 个测试连接；停止独立后端与 Chrome；删除容器 `sqldesk-abn-mysql`、`sqldesk-abn-pg`、`sqldesk-abn-redis` 和临时脚本目录。

## 14. Codex 修复复测（提交 4ea8522，2026-11-20）

复测对象：`fix: 优化 Redis 连接复用与键扫描，保留执行失败详情`（前端版本 1.1.1）。环境为 MySQL 8.4.10、Redis 7.4.12 单机 / 哨兵 / 三主三从集群，独立后端 `127.0.0.1:18089`。

### 1. Redis 连接复用

- 新增共享连接池：可共享命令复用同一客户端（池大小 16、空闲 2 分钟回收、最多 32 个池）；事务、阻塞命令与发布订阅仍走独立会话。集群客户端的状态刷新间隔改为 3 秒。
- 30 并发写入 20,000 个集群键：3.2s 完成，0 失败；期间 Windows `TIME_WAIT` 从 120 变为 116，未出现临时端口耗尽或 `Only one usage of each socket address`。
- 单机/哨兵/集群各顺序执行 300 次 `GET`：0 失败，单模式约 4.2–4.3s，p50 15ms。
- 每模式 100 并发：全部成功，约 34ms/34ms/28ms（单机/哨兵/集群），此前分别为 50/133/110ms。
- 30 并发 60KB `SET/GET`：全部成功，读取长度 60000。

### 2. 故障转移下的复用表现

- 哨兵：20 个并发 worker，2.5s 时关闭主节点 16379；哨兵将 16380 提升为主，首次成功出现在 3.475s（此前约 25s）。故障窗口内 6837 次成功、2274 次瞬态 `EOF`；故障结束后 5s 压测 3187 次全部成功，`GET sentinel:before` 仍为 `failover-value`。
- 集群：12 个并发 worker，2.5s 时关闭主节点 7000；7003 接管 0–5460 槽，`cluster_state:ok`。故障窗口内 4299 次成功、1160 次瞬态 `EOF`；结束后 5s 压测 1988 次全部成功，`SET/GET stress:after-fix2` 正常。
- 本轮失败仅为切换期 `EOF`，未再出现套接字/端口耗尽错误；故障结束后连接池稳定复用。故障窗口内的读请求不会自动重放（避免写命令重复执行），错误会在切换完成后停止。

### 3. 键扫描

- 后端全量集群扫描：201 页、20,030 个键、2.95s（与修复前基本一致）。
- 内置键浏览新增“连续扫描”：一次点击完成 20,030 个键，耗时 9.2s；修复前需 20 次点击、约 71.85s。
- 在 200ms 网络延迟下启动连续扫描并点击“停止扫描”：保留已扫描的 401 个键，扫描按钮恢复可用，未清空已有结果。

### 4. 执行失败详情

- MySQL 停机后关闭顶部红色横幅，展开“语句 1 执行失败”仍可看到 SQL 与完整原因 `dial tcp 127.0.0.1:13306 ... actively refused it`。
- Redis 停机后同样在消息项中保留 `read tcp ... wsarecv ... aborted` 详情。
- Redis 命令行模式展开“执行失败”可看到完整错误，重启 Redis 后同一命令恢复为 `"hello"`。
- 第 13.5 节“关闭横幅后无法查看连接级失败原因”的问题已解决。

### 5. 自动化与结论

- 后端 `go test ./...` 全部通过，`go vet ./...` 通过；前端 `pnpm build`、`pnpm lint`（39 项测试）通过。
- 三类修复均按预期生效：2 万键写入无端口耗尽、故障转移恢复从约 25–28s 缩短到哨兵约 3.5s 且随后稳定、全量键扫描从 20 次点击/71.85s 降至 1 次点击/9.2s、连接级失败详情关闭横幅后仍可查看。
- 未发现新增功能性问题。故障切换期间仍会有瞬态 `EOF`，属切换窗口预期。

本轮清理：删除 4 个测试连接；停止独立后端与 Chrome；删除容器 `sqldesk-fix-mysql`、`sqldesk-fix-redis`、`sqldesk-fix-sentinel`、`sqldesk-fix-cluster` 和临时脚本目录。

## 15. Codex 修复复测：集群扫描游标失效一键重扫（2026-11-20）

复测对象：当前工作区未提交修复（前端版本 1.1.2），无新提交号。环境为 Redis 7.4.12 三主三从集群（7000–7005）、独立后端 `127.0.0.1:18089`。

### 1. 游标失效场景

- 键浏览首次扫描加载 101 个键，游标指纹对应当时主节点 7000/7001/7002。
- 关闭主节点 7000，7005 接管 0–5460 槽位，`cluster_state:ok`；等待后端集群拓扑刷新后点击“扫描下一批”。
- 请求返回 409，页面提示“Redis 集群扫描范围已变化，请重新扫描”，保留已加载的 101 个键，并只显示“重新扫描”按钮。

### 2. 一键重扫

- 点击一次“重新扫描”，从新拓扑的 `cursor=0` 连续扫描；12.5s 完成 20,000 个键。
- 重扫后数量与数据一致、无重复，顶部错误横幅自动清除，扫描按钮恢复为完成状态。
- 失效前的已加载结果保留可用。

### 3. 接口语义

- 伪造旧指纹游标：HTTP 409，`{"error":"Redis 集群扫描范围已变化，请重新扫描"}`。
- 格式错误游标：HTTP 400，`{"error":"Redis 游标或筛选条件无效"}`，不会被误判为可重扫。
- 新拓扑下使用有效游标继续翻页：HTTP 200，扫描正常。

### 4. 自动化与结论

- 后端 `go test ./...` 全部通过（含新增的游标失效路由测试 `TestRedisScanRouteDistinguishesExpiredCursor`），`go vet ./...` 通过。
- 前端 `pnpm build`、`pnpm lint`（39 项测试）通过。
- 一键重扫功能按预期生效，未发现新增功能性问题。

本轮清理：删除测试连接；停止独立后端与 Chrome；删除容器 `sqldesk-cur-cluster` 和临时脚本目录。

## 16. 异常修复复测：无主键删除、日期弹层与关联页签（2026-11-20）

复测提交：`16c7d5b fix: 修正行删除提示、日期弹层和关联页签清理`。环境为 MySQL 8.4.10、独立后端 `127.0.0.1:18089`；主要交互使用内置浏览器多轮执行。

### 1. 无主键数据删除（多轮）

- 初始 5 行：`id=1` 两行完全相同、一行 `name` 为 NULL、一行中文、一行普通值。
- 第 1 轮删除一条重复行：5→4；数据库中 `id=1` 仅剩一条，未再出现“已删除 0 行”或“没有完整主键，无法安全删除”。
- 第 2 轮删除 NULL 行：4→3。
- 第 3 轮多选中文行与普通行：一次删除 2 行，3→1。
- 第 4 轮补入两条完全相同的行并同时选中删除：两条各删一次，剩余 2 行，无重复残留。
- 第 5 轮全选剩余行删除：0 行；“查询成功，没有匹配的数据”，表 `no_pk_rows` 仍然存在并可刷新，未误删表。
- 补充验证轮：重新写入 3 行（含一行重复），选中一行删除后 3→2，数据库中 `id=11` 只剩一条。
- 确认框文案已更新为“有主键时按主键定位，无主键时按原始整行匹配。相同记录每选中一条删一条。删除立即生效，遇到失败会停止。”

### 2. 空表日期弹层

- `no_pk_empty` 为 0 行，点击“新增行”打开 DATE 面板：面板挂在 body 级浮层，边界 top 276 / bottom 624，内置浏览器视口 785，未被表格容器裁切；TIME 面板 top 276 / bottom 547。
- 选择 `2026-11-20` 后编辑框保持打开，输入值正确；保存成功，数据库该行 `due_date=2026-11-20`。
- 未再出现日期/时间面板被下方遮挡，或点击面板导致单元格编辑结束的问题。

### 3. 删表/删库关联页签

- 表 `drop_me_no_pk` 同时打开数据、设计、结构、DDL 四个标签；删除确认框提示“删除成功后会关闭关联标签页”。执行删除后四个关联标签全部关闭，`no_pk_rows`、`no_pk_empty` 等无关标签保留，提示“删除表成功”，树节点移除。
- 数据库 `sqlstudio_dropdb` 打开 inside 数据页和一条含未保存 SQL 的查询页；删除时弹出“删除前是否保存关联查询？”，并列出“inside · 数据、查询 1”。选择“不保存”后数据库删除成功，两个关联标签关闭，其他数据库的标签保留。
- 删除表只影响该表标签，另一数据库中的同名表未被误删。

### 4. 自动化与结论

- 前端 `pnpm build` 成功，`pnpm lint` 39 项全部通过。
- 三个问题均按预期修复，未发现新增功能性异常。
- 未覆盖：包含 BLOB/空间类型等特殊列的整行匹配删除、删除前他处并发修改同一行的提示路径、PostgreSQL 对应界面回归。

本轮清理：删除测试连接；停止独立后端与 Chrome；删除容器 `sqldesk-tabfix-mysql` 和临时脚本目录。

## 17. 工作区查询与数据操作复测（提交 f9f041f，2026-11-20）

环境：MySQL 8.4.10、MariaDB 10.11、PostgreSQL 16、Redis 7.4；独立后端 `127.0.0.1:18089`。主要交互使用内置浏览器。

### 1. 查询行数限制

- 表数据预览保持 1000 行上限：`many_rows` 共 1500 行，数据页显示“共 1000 条”。
- 右键表选择“新建查询”生成 `SELECT * FROM \`sqlstudio_edit\`.\`many_rows\`;`，不含 `LIMIT`。
- 单条查询返回 1500 行，无行数截断；两条语句的批量执行生成“结果 1、结果 2”，两侧均为 1500 行；点击“重新执行”仍为 1500 行。

### 2. 无主键表编辑

- MySQL、MariaDB、PostgreSQL 的 `no_pk_edit` 均在同一行修改两个字段后一次保存，提示“已保存 2 处修改”。
- 数据库核对：MySQL `alpha-2/11`、MariaDB `alpha-maria/12`、PostgreSQL `alpha-pg/13`，两个字段同时生效。
- 无主键行删除中途失败：选中 2 行后从数据库修改第二行，删除时第一行成功、第二行提示“目标行已变化或不存在”；弹框显示“已确认删除 1 行”及原因，数据库中仅删除第一行。

### 3. 确认弹框

- 数据行删除：标题“删除选中的 2 行数据？”，显示范围 `sqlstudio_edit.no_pk_edit`；中途失败后切换为“删除结果”，只保留“关闭”。
- Redis 键删除：弹框显示“删除键”和“确定删除 Redis 键「delete:key」？”，确认后仅删除该键，`keep:key` 保留。
- 清空执行历史：显示连接名、总数 4 及“包括筛选未显示的记录”；确认后历史清空、按钮禁用。
- AI 会话删除：显示会话名 `Delete Session Test` 和删除范围“本机保存的消息和查询结果”；确认后会话从接口列表移除。
- 内置浏览器隐藏表面会暂停弹框离场动画，但弹框已是 `ant-zoom-leave` 关闭状态，功能不受影响。

### 4. 导出弹框

- 导出改为弹框，格式 CSV/Excel/JSON 与范围“已加载的筛选结果/选中行”均为横排圆点单选。
- 未选中行时“选中行（0）”禁用；选中 1 行后启用并可选。
- 模拟导出失败（`URL.createObjectURL` 抛错）：弹框保持打开，格式与范围选项保留，顶部显示“导出测试失败”。

### 5. Redis 双击与查询收藏

- 双击 Redis 连接节点只展开/收起，不再新建查询页；双击 Redis 数据库节点仍正常打开查询。
- 查询收藏打开动作的无障碍名称为“在新标签页打开”，点击后新建带 SQL 的查询页。
- 删除收藏确认显示收藏名称：“删除收藏「Delete Me Favorite」？”。

### 6. 自动化与结论

- 后端 `go test ./...`、`go vet ./...` 通过；前端 `pnpm build`、`pnpm lint` 39 项通过。
- 本轮五项修改均按预期生效，未发现新增功能性问题。
- 未覆盖：导出成功后的文件落盘与 1500 行文件内容校验、AI 会话在真实模型流式对话中的删除、特殊二进制列的整行编辑。

本轮清理：删除 4 个测试连接；停止独立后端与 Chrome；删除 MySQL、MariaDB、PostgreSQL、Redis 容器和临时脚本目录。

## 18. 未覆盖

- TLS/证书、超过 8MiB 的导出停止、导入 >1MiB 文件、macOS Command 快捷键、真实指针输入、MySQL/PostgreSQL 主从复制与切换、跨库分布式事务、Redis ACL 细粒度权限与 TLS、超过 30 秒的断网后恢复、本次断线环境中的 Agent 实时对话、Redis 在线扩缩容或槽迁移导致的游标失效、无主键表含 BLOB/空间类型等特殊列的整行匹配删除、导出成功后的实际文件落盘校验。
