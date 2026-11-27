# SQL Studio Oracle 接入与全流程测试报告

- 日期：2026-11-27
- 被测提交：`a0b17ec feat: 接入 Oracle 数据库`、`16596a1 chore: 统一 PostgreSQL 命名并拆分数据库测试配置`
- 方式：`sql/` Compose 启动多版本数据库（含全新数据卷初始化）+ 当前源码隔离后端 18089 + 当前前端源码（临时 Vite 15174）+ 内置浏览器 UI 实测
- 结论：**Oracle 全链路可用；Compose 与初始化脚本全部通过；Oracle 专项 78 项 0 失败；既有引擎回归 15/15；前端 Oracle 单测 4/4。发现 1 个需关注问题（Oracle DDL 冷启动超时）及 3 项使用提示。**

## 1. 环境与版本

| 引擎 | 默认版本 / 端口 | 兼容版本 / 端口 | 初始化结果 |
| --- | --- | --- | --- |
| MySQL | 8.4.10 / 13306 | 8.0.46 / 23306 | customers 1000、products 100、orders 5000、order_items 15000、视图 5000 |
| MariaDB | 11.4.13 / 13307 | 10.11.19 / 23307 | 同上（5 项计数一致） |
| PostgreSQL | 17.12 / 15432 | 16.16 / 25432 | 同上；金额一致性问题数 0 |
| Oracle | **Oracle Free 23.26.4.0.0 / 11521（FREEPDB1）** | **Oracle XE 21.3.0.0.0 / 21521（XEPDB1）** | 四表与视图计数 1000/100/5000/15000/5000；金额一致性问题数 0；中文/emoji/CLOB 正常 |
| GreptimeDB | 1.3.0 / 14002 | — | 2 张表 + 1 个视图，device_metrics 8 行、events 4 行 |
| Redis | 7.4.12 / 16379 | 6.2.24 / 26379 | DB0/DB1 各 9 个键，含 Hash/List/Set/ZSet/Stream/TTL |

- 所有 Compose 文件均通过 `docker compose config -q`（mysql/mariadb/postgresql/oracle/greptimedb/redis）。
- 本次使用**新数据卷**启动，初始化脚本由各镜像入口真实执行；所有服务最终 `healthy`。
- Oracle Free 首次启动约 5–6 分钟（解压 33s + 实例与 PDB 打开），符合低内存 Docker VM 表现。

## 2. Oracle 专项矩阵（78 项：73 通过 / 0 失败 / 5 记录）

覆盖内容：

- **连接与对象树**：版本 23.26.4.0.0；服务 FREEPDB1；Schema、表、视图、字段（7 列）、索引（3）、外键（2）、DDL（DBMS_METADATA，667 字节）。
- **DDL/DML**：NUMBER(38,10)、VARCHAR2(CHAR)、CLOB（JSON CHECK）、RAW、虚拟列、CHECK 约束、主键/索引、序列、子表外键、视图、全局临时表、中文标识符；MERGE、序列 NEXTVAL、层级 CONNECT BY、PIVOT、窗口函数、GROUPING SETS、递归 CTE、FETCH FIRST、ROWID、Q 引号（`q'[O'Reilly; ;]'`）、RAW/JSON 函数、NUMBER 精确文本。
- **PL/SQL**：匿名块、存储过程（OUT 参数）、函数、触发器（触发器内修改 `:NEW.qty`）；过程调用结果经表校验（qty=5）。
- **只读与消息边界**：默认只读拒绝 INSERT/SELECT FOR UPDATE；单条请求拒绝多语句与事务控制；批次内 COMMIT/ROLLBACK 生效、临时表同批次可见/跨请求不可见；200 条 INSERT 显式事务 313ms。
- **错误映射**：ORA-00001/02291/02290/01400/00904/00942/00900/01722/01476/12899 全部按预期归类并停止后续语句。
- **长 SQL/边界**：3000 字节字面量、900 项 IN、100 UNION ALL、100 列、200 层括号、默认 1000 行截断、`unlimitedRows` 5000 行、CLOB 随机串。
- **服务能力**：监控（表 4、视图 1、索引 15、无效对象 0）、表数据 SSE 导出（1000 行）、结构同步（4 表、跳过 1 视图，目标 Schema 4 表）。

记录项（非缺陷）：

| 项 | 实测 |
| --- | --- |
| 1MB 字符串字面量 | Oracle 报 `ORA-01704: string literal too long`（Oracle SQL 限制） |
| 5000 项 IN 列表 | Oracle 23ai 接受（旧版本常见的 ORA-01795 未出现） |
| 5 并发 `DBMS_SESSION.SLEEP(1)` | 4×200 + 1×429，总耗时约 1.1s |
| 取消长 PL/SQL 调用 | 客户端中断后立即恢复查询 |
| 单请求会话 | 每次独立会话（与设计一致） |

## 3. 既有引擎回归（15/15）

- MySQL 8.4/8.0、MariaDB 11.4/10.11：视图聚合查询一致（5000 行，金额 3,579,375.00）；批次错误停止语句数 2。
- PostgreSQL 17/16：美元引号含 `;` 正常、聚合 1000；批次错误停止正常。
- GreptimeDB：`device_metrics` 8 行。
- Redis 7.4/6.2：`sqlstudio:demo:greeting` 返回中文/emoji。
- 只读边界：MySQL 返回“只读查询不允许该语句…”；PostgreSQL 返回只读事务错误。
- 前端 Oracle 适配器单测（切分/Q 引号/PLSQL 完整性/表身份/NUMBER 精度/转储外键）4/4 通过。

## 4. 内置浏览器 UI 实测

使用当前前端源码 + 当前后端（18089）：

| 功能 | 结果 |
| --- | --- |
| 工作区/对象树 | Oracle 显示 `FREEPDB1 → SQL_STUDIO_DEMO → 表/视图`；CUSTOMERS 可展开字段、索引、外键（无外键时显示“暂无外键”） |
| 表数据页 | CUSTOMERS 1000 行；NUMBER/NCHAR/TIMESTAMP/CLOB 类型标注正确，NULL 显示 `(NULL)`，中文与 emoji 正常（315ms） |
| SQL 窗口 | 4 条语句（2 条 SELECT + 1 个带内部 `;` 的 PL/SQL 块 + 1 条 Q 引号含 `;` 的 SELECT）生成 3 个结果页签；消息页显示 4 条全部成功；PL/SQL 由独立一行 `/` 正确结束 |
| 结果内容 | 结果1 `1000`、结果2 `1000`、结果3 `a;b` |
| 执行历史 | 4 条记录，包含连接、FREEPDB1、Schema 列（SQL_STUDIO_DEMO）、SQL 与耗时；PL/SQL 保留 `/` |
| 监控指标 | 版本 v23.26.4.0.0；表 4、视图 1、索引 15、无效对象 0；提示“Oracle 会话指标不可用，需要 V$SESSION 读取权限” |
| 同步页 | 选择 Oracle 后切换为“源 Schema / 目标 Schema”，提示“Oracle 同步使用已有空 Schema。目标 Schema 含有对象时停止。” |
| 新建连接 | 引擎列表含 Oracle（品牌图标）；默认端口 1521、服务名 FREEPDB1 及帮助文案、本地加密标识、横向表单 |
| AI 助手 | DeepSeek 只读模式完成 Oracle 查询：9 项操作，返回 CUSTOMERS 1000、ORDERS 5000 的二维结果表并可导出 Excel |

截图（`test-reports/screenshots-oracle/`）：

- [工作区查询](screenshots-oracle/workspace-query.png)
- [表数据页](screenshots-oracle/data-page.png)
- [Oracle 监控](screenshots-oracle/monitor-oracle.png)
- [Oracle 同步](screenshots-oracle/sync-oracle.png)
- [新建连接（Oracle）](screenshots-oracle/connection-modal-oracle.png)
- [AI 助手 Oracle 查询](screenshots-oracle/agent-oracle.png)

## 5. 发现与建议

### 5.1 [中] Oracle DDL 冷启动超过 10s 元数据超时

- 现象：首次打开表结构/读取 DDL 时，`DBMS_METADATA.GET_DDL` 在低配 Docker VM 上超过元数据接口的 10s 超时（`modules/metadata/ports.go: metadataTimeout`），接口返回 `read tcp ... use of closed network connection`；矩阵中第 2 次重试成功，手工测试第 3 次成功。
- 影响：慢环境/冷会话下，首次“查看 DDL”可能报错，需要用户重试。
- 建议：Oracle DDL 首次调用前预热元数据参数/包，或对 DDL 单独放宽超时并做一次自动重试；UI 对可重试错误给出“重试”入口。

### 5.2 [低] Oracle 表预览无稳定顺序

- 现象：数据页使用 `FETCH FIRST 1000 ROWS ONLY`（无 ORDER BY），同一表预览起始行可能从 ID 133 开始，而非 1。
- 评价：符合“按数据库返回顺序预览”的实现；若希望更直观，可按主键/ROWID 稳定排序，或在界面标注“无排序预览”。

### 5.3 [提示] 普通 Schema 账号无 `V$SESSION`，监控仅显示对象指标

- Demo 账号只展示表/视图/索引/无效对象，监控页给出权限提示；授予 `SELECT ON V$SESSION` 后可显示会话指标。属于权限设计而非缺陷。

### 5.4 [提示] 初始化脚本只在新数据卷执行

- 本次为全新卷，所有初始化脚本均执行成功。已有卷不会重新执行更新后的 `init.sql`；升级样例数据需显式重建卷（会丢失卷内数据）。
- Oracle Free 启动期间可短暂出现 `V_ORDER_SUMMARY does not exist`（视图在脚本末尾创建）；等容器 `healthy` 后再操作即可。

## 6. 交付与清理

- 测试栈（6 个 Compose 项目，含兼容版本）已全部 `stop`，**数据卷保留**，可随时 `docker compose -f sql/<engine>/docker-compose.yml up -d` 再次启动。
- 测试期间 Docker Desktop 引擎曾无响应，已重启 Docker Desktop/WSL；用户原有 `mysql`、`redis` 容器已恢复运行。
- 隔离后端（18089）、临时 Vite（15174）已停止；隔离状态目录（含测试连接与 DeepSeek Key）已删除。
- Oracle 临时测试用户（SQLSTUDIO_VERIFY/SYNC/PROBE）已全部删除，`SQL_STUDIO_DEMO` 样例保持不变。
- 证据文件：`.test-runtime/oracle/matrix-results.json`、`regression.json`、`run.log`；截图见上文目录。
- 注意：正在运行的 18080 后端仍是旧进程（11-24 启动），15173 开发服务器也未包含本次提交；需重启后端并重新构建前端，或使用当前源码的开发环境，才能在用户的常驻实例中看到 Oracle 支持。