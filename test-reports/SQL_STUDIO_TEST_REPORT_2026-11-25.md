# SQL Studio 全功能与多版本 SQL 兼容性测试报告

- 日期：2026-11-25
- 方式：内置浏览器 UI 验证 + 真实 HTTP/API 语句矩阵 + Docker 多版本数据库
- 被测对象：当前工作区源码运行中的前端 15173 / 后端 18080（只读浏览）+ 隔离后端 18089（全部写操作仅作用于临时对象）
- 结论：**自动化检查无失败项。发现 2 个代码问题（1 中、1 低），无阻断性缺陷。**

## 1. 测试环境

| 引擎 | 版本 | 来源 |
| --- | --- | --- |
| MySQL | 5.7.44 / 8.0.46 / 8.4.10 | Docker `mysql:5.7`、`mysql:8.0`、`mysql:8.4.10` |
| MariaDB | 10.11.19 / 11.4.13 | Docker `mariadb:10.11`、`mariadb:11.4` |
| PostgreSQL | 13.23 / 16.16 / 17.12 | Docker `postgres:13/16/17-alpine` |
| GreptimeDB | 1.3.0（MySQL 协议 8.4.2） | Docker `greptime/greptimedb:v1.3.0` |
| Redis | 7.4.12 | Docker `redis:7.4-alpine` |
| 前端 / 后端 | 15173（Vite 开发）、18080（运行中） | 用户已启动的实例，仅只读验证 |
| 隔离实例 | 18089 + 独立 state/data 目录 | 用于建测试连接、执行全部写操作；结束已停止并删除临时数据 |

补充环境：Docker 中另有用户原有的 `mysql`（8.4.10，localhost）与 `redis`（6.2）保持运行，未改动其业务库；Aliyun MySQL 连接未被用于任何测试。

> 内置浏览器当前没有可见画布（viewport 0×0），`take_screenshot` 不可用。UI 验证通过可访问性快照 + 页面内事件模拟完成，交互与渲染内容均已核对；**未提供像素级截图证据**。

## 2. 执行统计

语句矩阵覆盖 SQL、Redis 命令和 AI 场景。补充验证覆盖元数据、监控、导出、同步和边界场景。

分引擎通过数：MySQL 5.7/8.0/8.4 = 70/71/71，MariaDB 10.11/11.4 = 68/68，PostgreSQL 13/16/17 = 76/76/76，GreptimeDB 19，Redis 35，AI 5。

## 3. 语句覆盖

### 3.1 MySQL / MariaDB（5 个版本）

- **DDL**：建库、主键/唯一/外键/CHECK、ENUM、JSON、生成列、普通/表达式/全文索引、HASH 分区、视图、中文库表列名、改列。
- **DML 与查询**：多行 INSERT、唯一键冲突、外键冲突、NOT NULL、CHECK、非法 JSON、非法 ENUM、超长数值、CTE（含递归）、窗口函数、JSON 函数、ROLLUP、多表 UPDATE、`ON DUPLICATE KEY`、RETURNING（MariaDB）、SEQUENCE（MariaDB）、`VALUES ROW`（MySQL 8）。
- **存储程序与会话**：单语句创建存储过程（含 `BEGIN…END;` 内部多条语句）、CALL、触发器、事件、PREPARE/EXECUTE/DEALLOCATE、临时表、事务 BEGIN/SAVEPOINT/ROLLBACK/COMMIT、同批次 200 条 INSERT、300 条 SELECT。
- **疑难/长 SQL**：1MB 字符串字面量、5000 项 IN 列表、100 个 UNION ALL、100 列结果、200 层嵌套括号、重复列名、bigint/DECIMAL(40,20) 文本保真、二进制转十六进制、emoji/中文、字符串内分号与转义引号、行注释/块注释内分号、CRLF、保留字别名、`USE` 切库。
- **UI 分句专项**：`SELECT 'a;b'…` + 注释分号 + 第二句正常执行；`DELIMITER // CREATE PROCEDURE … END// … CALL` 在 SQL 窗口执行成功（历史记录显示 CREATE PROCEDURE 与 CALL 两条）。**此前“UI 会拆坏存储程序”的问题已修复。**

### 3.2 PostgreSQL

- **对象**：ENUM、DOMAIN、IDENTITY、生成列、表达式/部分/GIN 索引、视图、物化视图、SEQUENCE、SQL/PLpgSQL 函数、触发器、RANGE 分区父表与分区、`CREATE INDEX CONCURRENTLY`、`VACUUM ANALYZE`、`COMMENT ON`、中文标识符、大小写敏感标识符。
- **查询**：递归 CTE、LATERAL、GROUPING SETS、窗口帧、数组/范围、JSONB、全文检索、`INSERT … RETURNING`、`ON CONFLICT`、`UPDATE … FROM`、`MERGE`（16+）、`JSON_TABLE`（17+）、`ANY_VALUE`（16+）、`pg_stat_io`（16+）、multirange（14+）、DO 块、事务与 SAVEPOINT、临时表、CALL 过程。
- **疑难/长 SQL**：美元引号（含 `;`、`$$`）、E 字符串、嵌套块注释、1MB 字面量、5000 项 IN、100 UNION、100 列、200 层括号、`chr(0)`（按预期拒绝）、重复列名、bigint/NUMERIC 文本保真、BYTEA 十六进制。

### 3.3 GreptimeDB / Redis / AI

- GreptimeDB：TIME INDEX 建表、写入、倒序查询、聚合、SHOW TABLES/DATABASES、DESCRIBE、视图、加列、information_schema、1MB 字面量、5000 IN、未知表/语法/多语句错误；批量接口返回“该引擎不支持同一会话批量执行”。
- Redis：String/Hash/List/Set/ZSet/Stream/Bitmap/HLL/Geo、TTL/PERSIST、TYPE、WRONGTYPE、EVAL（含 1000 键批量写）、60KB 值、64KiB 命令上限、SCAN 分页、键详情；`MULTI` 被拒绝并提示使用独立会话。
- AI（DeepSeek `deepseek-chat`）：保存配置、拉取模型列表、SQL 续写（complete）、SQL 优化（optimize）、Redis 连接被拒绝（400）。Key 仅写入隔离实例，随临时 state 目录一并删除。

## 4. 版本兼容性实测差异（均为数据库行为，产品正确透传）

| 语法/特性 | MySQL 5.7 | MySQL 8.0/8.4 | MariaDB 10.11/11.4 | PG 13 | PG 16 | PG 17 |
| --- | --- | --- | --- | --- | --- | --- |
| CTE / 窗口函数 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| JSON_TABLE | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| `EXPLAIN ANALYZE` | ✗ | ✓ | ✗ | ✓ | ✓ | ✓ |
| `VALUES ROW(...)` | ✗ | ✓ | ✗ | — | — | — |
| SEQUENCE / RETURNING | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| CHECK 约束强制执行 | ✗（忽略） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `utf8mb4_0900_ai_ci` | ✗ | ✓ | 10.11 ✗ / 11.4 ✓ | — | — | — |
| `ALTER INDEX … INVISIBLE` | ✗ | ✓ | ✗ | — | — | — |
| JSON `->>` 操作符 | ✓ | ✓ | ✗（用 JSON_EXTRACT） | — | — | — |
| `SELECT 1 WHERE …`（无 FROM） | ✗（需 FROM DUAL） | ✓ | ✓ | ✓ | ✓ | ✓ |
| MERGE | — | — | — | ✗ | ✓ | ✓ |
| ANY_VALUE / pg_stat_io | — | — | — | ✗ | ✓ | ✓ |
| multirange | — | — | — | ✗ | ✓ | ✓ |

- 跨版本结构同步 MySQL 8.4 → 5.7 被后端拒绝：“目标不支持源库排序规则或 InnoDB”（源库使用 0900 排序规则），属预期保护；MySQL 8.4 → 8.0 同步检查通过（10 表，跳过 1 视图）。
- MariaDB 11.4 接受 `utf8mb4_0900_ai_ci`，10.11 不接受，属真实版本差异。

## 5. UI 功能验证（隔离实例 18089 + 运行实例 15173）

| 功能 | 结果与证据 |
| --- | --- |
| 工作区与连接树 | 11 条测试连接加载；展开 MySQL 后列出 6 个库、表/视图分组、字段/索引/外键节点；展开 PG 显示 schema 分组；Redis 显示逻辑库 0–15 |
| 表数据页 | 双击 users 打开“数据”页：4 行 × 8 列；NULL 显示 `(NULL)`，emoji、`O'Brien; DROP` 等值正确；排序表头、筛选、新增/删除行、保存/放弃修改、刷新、导出控件齐全 |
| SQL 窗口 | 多语句生成独立结果页签；`s1=a;b`、`s2=x'y;z` 正确；消息页签逐语句显示；错误时“语句 2 执行失败 + 后续 1 条语句未执行”；结果 1 保留 |
| DELIMITER 存储过程 | CREATE PROCEDURE（206ms）+ CALL（1ms）两条均成功，无语法错误 |
| 执行历史 | 抽屉列表 14 条，含状态/执行时间/连接/库/SQL/耗时/复制 SQL/载入编辑器 |
| AI 优化 | 点击“优化”弹出“优化建议”：原文、调整结果、中文调整说明（DeepSeek 返回） |
| AI 助手 | 只读模式、DeepSeek Chat；提问“列出 sqltest_80_r2 有哪些表”返回 4 项操作、10 张表 + 1 视图、结果表格及“导出 Excel” |
| Redis 查询 | `GET sqltest:str` 返回 `值 带空格😀:tail`；键浏览 SCAN 100、前缀分组、点选键显示类型/字节数/TTL/键值编辑 |
| PostgreSQL 查询 | 连接/数据库/schema 三级切换（postgres / sqltest_pg17_r2），3 条语句批次产生 2 个结果页签，唯一键冲突在第 3 条正确报错 |
| 系统设置 | 模型配置显示 DeepSeek Chat（deepseek-chat，默认）；通用/外观/语言/关于页签存在 |
| 监控指标 | MySQL 5.7/8.4、MariaDB、PG13/16/17、Greptime、Redis 监控均返回指标；监控页展示实例概览、语句/连接/网络/InnoDB 趋势 |
| 同步数据库 | 三步向导渲染；API 实测 MySQL 8.4 → 8.0 结构同步成功（10 表） |
| 表数据导出 | MySQL/PG 的 SSE 导出返回 rows+done（4 行/7 行）；GreptimeDB 返回“该引擎不支持流式导出”（符合能力范围） |
| 运行中的用户实例 | 15173 打开正常，3 条连接（localhost/Redis/阿里云），localhost 展开列出业务库，/monitor 显示 v8.4.10 指标；未向业务库执行写操作 |

> 说明：测试期间（16:00）`sql-studio-frontend/dist` 被重新构建，已打开的 SPA 仍引用旧 hash 的懒加载 chunk，进入监控页时出现一次 `/assets/databaseMonitor-*.js` 404 空白页，刷新后恢复。属“构建产物替换后旧页面未刷新”的部署表现，非代码缺陷；发版/热更新后需刷新页面。

## 6. 性能与边界

| 场景 | 结果 |
| --- | --- |
| 同批次事务 200 条 INSERT | MySQL 5.7 110ms / 8.0 198ms / 8.4 163ms；MariaDB 98/90ms；PG13/16/17 160/150/159ms |
| 300 条 SELECT 1 同批次 | 63–142ms（各引擎） |
| 1000 条语句批次 | 218ms，195KB NDJSON |
| 1MB 字符串字面量 | 53–115ms，长度校验通过 |
| 2MB 单条语句 | 成功（此前“单条 >1MiB 不可执行”的限制已不存在） |
| 33MB 请求体 | 413，提示“请求体超过大小上限（32 MiB）” |
| 9MB 单单元格结果 | `truncated=true`、`truncatedBy=oversized-row`、`rowCount=0`、`rowPreview` 1 项 |
| 5 并发 `SLEEP(1)` | 4×200 + 1×429，总耗时约 1.0s（4 槽位上限生效） |
| 客户端取消长查询 | 中断后立即 `SELECT 7` 正常，运行槽位释放 |
| 30 秒执行期限 | 30.0s 返回 400 `context deadline exceeded` |
| 默认行数上限 | 5000 行结果默认截断为 1000 行（`row-limit`）；`unlimitedRows` 返回 5000 行 |

## 7. 问题与建议

### 7.1 [中] `EXECUTE` / `CALL` 的返回结果集未透传（MySQL / MariaDB）

- 现象：批次执行 `EXECUTE stmt USING @a`（SELECT ? + 1）与 `CALL proc()`（过程内 `SELECT 42`）时，事件结果均为空、`isQuery=false`；过程本身创建成功。
- 定位：`internal/mysql/statement.go` 的 `isQuery` 关键字列表为 `SELECT/SHOW/DESC/DESCRIBE/EXPLAIN/TABLE/VALUES`，未包含 `EXECUTE`、`CALL`；查询走 `Exec` 路径后结果集被丢弃。
- 影响：用户在 SQL 窗口执行预处理语句或含结果集的存储过程时看不到数据行，只能通过中间表/`SELECT @var` 间接取值。
- 处理：显式写入路径按顺序读取 `EXECUTE`、`CALL` 返回的数据集，分别展示为结果页签，消息、摘要和历史仍按语句记录。修复已静态核对，待运行复测。
- 证据：MySQL 5.7/8.0/8.4、MariaDB 10.11/11.4 一致复现；`matrix-results.json` 中“EXECUTE 结果集是否透传”“CALL 内含 SELECT 的结果集”。

### 7.2 [低] 30 秒超时的错误文案未本地化

- 现象：`SELECT SLEEP(31)` 在 30s 后返回 `{"error":"context deadline exceeded"}`（HTTP 400），UI 会直接显示英文。
- 处理：单条 SQL、整个批次和会话初始化分别返回本地化超时提示。修复已静态核对，待运行复测。
- 证据：`extra-results.json` “30 秒执行期限”。

### 7.3 [设计事实] 单语句请求使用独立会话

- 现象：两次独立请求的 `CONNECTION_ID()/pg_backend_pid()` 不同；跨请求 `BEGIN → INSERT → ROLLBACK` 后 INSERT 仍保留；临时表在下一请求不可见；同批次脚本内事务/临时表则正常共享。
- 评价：与文档“每个多语句批次使用独立会话”一致，但用户容易误以为 BEGIN/ROLLBACK 跨多次执行有效。
- 处理：文档补充了事务和临时表的批次范围说明。MySQL、MariaDB 的同会话批次沿用 PostgreSQL 的单条重跑保护。改动已静态核对，待运行复测。

### 7.4 [设计事实] 超大单元格触发首行只读预览

- 现象：9MB 单元格返回 `rowCount=0`、`truncatedBy=oversized-row`，仅给出 1 个截断预览值。
- 评价：符合约 8 MiB 的结果预算。源码已有黄色提示“首行超过 8 MiB，仅提供只读预览。”，并展示截断值。提示醒目程度待视觉走查。

### 7.5 其他已确认的边界（非缺陷）

- GreptimeDB 不支持同会话批量执行（400，文案明确）与流式导出；其 SQL 执行、对象浏览、监控正常。多次尝试 TQL 时间窗口语法均被服务器以 `Invalid TQL syntax` 拒绝，未确认为产品问题。
- Redis `MULTI` 返回“该命令需要独立会话…”的明确拒绝；>64KiB 命令按预期 400。
- 跨版本同步会校验目标排序规则/引擎能力并提前拒绝（8.4→5.7 因 0900 排序规则被拒绝）。

## 8. 未覆盖范围

- 未做像素级视觉走查（内置浏览器无可视画布，无法截图）。
- 未验证：SQL 转储文件落盘/下载、Redis 发布订阅实时流、Redis 哨兵/集群、Agent 完全访问模式的逐次写入确认、TLS、网络分区与 30s 挂起、百万级数据量压力（本次以 1000 语句/5000 行/9MB 结果等边界为主）。
- 运行中的 18080 实例仅做只读浏览，未对阿里云连接或业务库执行任何语句。

## 9. 清理

- 已删除测试容器（MySQL 5.7/8.0、MariaDB 10.11/11.4、PG13/16/17、Redis 7.4、GreptimeDB）。
- 已停止隔离后端（18089），删除其独立 state/data 目录（含测试连接与 DeepSeek Key）。
- 已从 localhost 的 MySQL 8.4 容器删除两个测试库 `sqltest_84`、`sqltest_84_r2`；业务库 `oa_printer_dev`、`qianguanguan`、`sql_studio_demo`、`sqlstudio_no_pk_test` 等原样保留。
- 用户原有容器（mysql、redis）与前端/后端开发服务未停止。
- 证据保留：`.test-runtime/2606/matrix-results.json`、`extra-results.json`、`matrix.mjs`、`extra.mjs`（该目录被 .gitignore 忽略）。

## 10. 结论

- 功能完整性：对象树、数据页、SQL 窗口、多语句/多结果、历史、设计入口、监控、同步、Redis、AI 助手与 AI 补全/优化均可用，错误与取消行为符合文档。
- 多版本语句执行：MySQL 5.7–8.4、MariaDB 10.11/11.4、PostgreSQL 13/16/17、GreptimeDB、Redis 7.4 的长 SQL、深嵌套、大列表、Unicode、事务、存储程序与典型错误场景全部按预期工作。
- 主要改进项：`EXECUTE`/`CALL` 结果集透传（中）与超时文案本地化（低）。
