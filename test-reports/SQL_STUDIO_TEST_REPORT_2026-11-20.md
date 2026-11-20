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
- 内置浏览器仍无可见表面，无法真实指针/截图；错误详情需手动展开、动画冻结等问题仍属环境限制。

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

## 10. Codex 修复复测（最新工作区）

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
| 自动化 | 前端真实窗口集成 53/53；Node 测试 222 通过/3 跳过；后端集成通过；Vite 构建成功 |

### 新增阻塞/需修复

1. **前端生产构建与 lint 失败（TS1117）**：`translations/index.ts` 第 909 行重复定义 `结果已达行数或大小上限，请收窄查询范围。`（第 750 行已有），`pnpm build`、`pnpm lint` 均因 `tsc` 失败；本次 UI 功能验证改用 `vite build`（跳过类型检查）完成。需删除重复键并保留一份英文文案。
2. **后端架构测试失败**：`go test ./...` 的 `TestInternalDependencyDirection` 报 `app\agent.go 不得跨引擎依赖 MySQL 驱动`。Agent 错误归一化直接在 app 层引入了 `github.com/go-sql-driver/mysql`，应下沉到 engine/database 层或通过抽象错误分类避免跨层依赖。
3. **格式检查仍失败**：`pnpm format:check` 仍有 105 个文件不符合格式。

本轮 4 个容器、`fv_*` 库/schema、连接和临时目录均已清理；验证过程未修改源码。

## 11. 未覆盖

- TLS/证书、完整 30 秒超时边界、超过 8MiB 的导出停止、导入 >1MiB 文件、macOS Command 快捷键、真实指针/截图、复制/集群/故障切换、跨库分布式事务、Redis 集群模式与 ACL 细粒度权限。