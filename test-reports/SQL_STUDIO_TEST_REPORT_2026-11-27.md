# SQL Studio 全局功能与多版本 SQL 测试报告

- 日期：2026-11-27
- 代码基线：`68e9f79`（含 `34265c7` 对 Oracle 元数据读取的 30s 修复、窄屏工具栏与焦点样式调整）
- 方式：当前源码重建后端（18080）+ 用户正在运行的 Vite（15173）+ Qoder 内置浏览器 UI 实测 + Docker Compose 多版本数据库
- 结论：**Oracle 与新改动全链路通过；自动化 187 项 0 失败；UI 发现 1 个可复现的查询页连接切换问题，Oracle DDL 30s 修复在资源充足时生效。**

## 1. 环境

| 引擎 | 默认 | 兼容版本 | 端口 |
| --- | --- | --- | --- |
| MySQL | 8.4.10 | 8.0.46 | 13306 / 23306 |
| MariaDB | 11.4.13 | 10.11.19 | 13307 / 23307 |
| PostgreSQL | 17.12 | 16.16 | 15432 / 25432 |
| Oracle | Free 23.26.4.0.0（FREEPDB1） | XE 21.3.0.0.0（XEPDB1） | 11521 / 21521 |
| GreptimeDB | 1.3.0 | — | 14002 |
| Redis | 7.4.12 | 6.2.24 | 16379 / 26379 |

- 6 个 `sql/*/docker-compose.yml` 均通过 `docker compose config -q`；11 个数据库实例均已启动并核对初始化数据。
- 初始化数据核对：MySQL/MariaDB/PG/Oracle 四表与视图均为 **1000 / 100 / 5000 / 15000 / 5000**，Oracle 金额一致性问题数 0；Greptime 8 条指标 + 4 条事件 + 汇总视图；Redis DB0/DB1 各 9 个键（含 Hash/List/Set/ZSet/Stream/TTL）。
- 说明：18080 原先运行的是 10:36 的旧二进制，本次已替换为当前源码构建的进程；前端继续使用 15173 的开发服务器（热更新当前代码）。

## 2. 自动化结果

| 套件 | 检查项 | 通过 | 记录项 | 失败 |
| --- | --- | --- | --- | --- |
| Oracle 当前代码专项（71 项） | 71 | 68 | 3 | **0** |
| 其他引擎与版本兼容（116 项） | 116 | 110 | 6 | **0** |
| 内置浏览器 UI 检查 | 12 个场景 | 11 | 1（下述 UI 问题） | 0 |

Oracle 专项覆盖：连接/对象树、DDL（NUMBER/CLOB JSON/RAW/生成列/CHECK）、MERGE、序列、PIVOT、CONNECT BY、递归 CTE、窗口/GROUPING SETS、FETCH FIRST、Q 引号、匿名块/过程/函数/触发器、全局临时表、事务提交回滚、只读拦截、10 类 ORA 错误映射、批次错误停止、200 条 INSERT 显式事务（313ms）、3000 字节字面量、900/5000 项 IN、100 UNION、100 列、200 层括号、1000 行截断与 unlimited 5000 行、并发 4+1×429、取消恢复、监控、SSE 导出 1000 行、结构同步（4 表 + 跳过视图，目标 4 表）。

其他引擎覆盖：视图聚合、分号/引号/emoji、1MB 字面量、5000 项 IN、100 UNION、100 列、200 层括号、默认截断、CTE/窗口、JSON_TABLE、EXPLAIN ANALYZE、VALUES ROW、JSON 提取、批次错误停止、只读拒绝写入；PG 美元引号/递归 CTE/JSONB/数组/ANY_VALUE/pg_stat_io/临时表；Redis 初始化键、Hash/ZSet、WRONGTYPE、EVAL、SCAN；Greptime 计数、长 SQL、错误。

### 2.1 Oracle DDL 30s 修复验证

- Oracle Free 首次读取 DDL（不重试）：**17.6s 成功**（旧 10s 超时问题已解决）。
- Oracle XE 冷启动、与 Oracle Free 同时运行时：30s 超时 3 次，返回本地化提示「读取 Oracle DDL 超时，请重试。」；停止 Free 释放内存后同一请求 **2.1s 成功**。
- 结论：30s 限制与提示生效；3.8GiB Docker VM 上两个 Oracle 实例并存时资源竞争明显，属环境限制，建议在低配环境提供一键重试（见 3.2）。

## 3. UI 实测（15173 + 内置浏览器）

| 场景 | 结果 |
| --- | --- |
| 工作区与连接树 | 默认分组、Docker 测试库、测试临时分组正常；Oracle Free 展开 `FREEPDB1 → SQL_STUDIO_DEMO → 表/视图`，字段/索引/外键节点完整 |
| Oracle 数据页 | CUSTOMERS 1000 行；NUMBER/NCHAR/TIMESTAMP/CLOB 类型正确，NULL 显示 `(NULL)`，中文/emoji 正常；新增「无排序预览」提示（对应上轮建议） |
| Oracle SQL 窗口 | `SELECT COUNT(*)` + `PL/SQL 块 + /` + Q 引号含 `;` 三条语句：结果 1=1000、结果 2=a;b，消息页 3 条全部成功 |
| MySQL SQL 窗口 | 5 条语句（字符串/注释含分号 + 视图查询 + 未知表 + 后续语句）：生成 2 个结果页签，第 3 条失败并提示“后续 1 条语句未执行” |
| Redis 窗口 | `PING` / `DBSIZE` 两条命令生成两个结果页签，结果 PONG 与 3 |
| 监控页 | Oracle v23.26.4.0.0：表 4、视图 1、索引 15、无效对象 0；提示 V$SESSION 权限不足 |
| 同步页 | 切换 Oracle 后为“源 Schema / 目标 Schema”，提示“Oracle 同步使用已有空 Schema” |
| 新建连接 | 引擎含 Oracle，默认端口 1521、服务名 FREEPDB1 与帮助文案、横向表单；连接测试返回 23.26.4.0.0 |
| AI 助手 | DeepSeek-V4.1-Flash 只读完成 Oracle 查询：5 项操作，返回 CUSTOMERS 1000 / ORDERS 5000 结果表 |


## 4. 版本兼容性差异（实测）

| 特性 | MySQL 8.0/8.4 | MariaDB 10.11/11.4 | PG 16 | PG 17 | Oracle 23ai / XE21 |
| --- | --- | --- | --- | --- | --- |
| CTE/窗口 | ✓ | ✓ | ✓ | ✓ | ✓ |
| JSON_TABLE | ✓ | ✓ | ✗ | ✓ | — |
| EXPLAIN ANALYZE | ✓ | ✗ | ✓ | ✓ | — |
| VALUES ROW | ✓ | ✗ | — | — | — |
| `->>` 运算符 | ✓ | ✗（用 JSON_EXTRACT） | — | — | — |
| 5000 项 IN | ✓ | ✓ | ✓ | ✓ | 23ai ✓（旧版限制 ORA-01795） |
| 1MB 字符串字面量 | ✓ | ✓ | ✓ | ✓ | ✗ ORA-01704 |
| ANY_VALUE / pg_stat_io | — | — | ✓ | ✓ | — |

## 5. 问题与建议

### 5.1 [中] 查询页切换到“未在对象树打开”的连接后，数据库列表不加载

- 复现：查询页已打开连接 A；在顶部连接选择器切换到连接 B（B 未在对象树展开）。请求记录显示 `POST /connections/B/session` 200，但**没有** `GET /connections/B/databases`；数据库选择器保持禁用（“选择数据库”），刷新页面也无法恢复；在对象树展开 B 后立即恢复可用。
- 影响：不先展开对象树就无法在查询页切换数据库；恢复工作区时若活动查询页的连接未在树中打开，也会落到同样的禁用状态。
- 建议：`selectConnection`/恢复活动页时显式调用 `openConnection` 并等待 `databases` 加载完成；或在 `snapshot.status === 'connected'` 但 `databases` 为空时补拉数据库列表。
- 证据：切换后网络仅 session 200；页面选择器 `disabled=true`；树展开后 `/databases` 返回 200 且选择器启用。

### 5.2 [低/环境] 低配 Docker VM 上两个 Oracle 实例并存时 DDL 冷读仍可能超 30s

- Oracle Free 17.6s 成功；同时运行 Free + XE 时 XE 连续 30s 超时；停止 Free 后 XE 2.1s 成功。提示已本地化为「读取 Oracle DDL 超时，请重试。」。
- 建议：对 Oracle DDL 超时提供 UI 重试按钮或一次自动重试；或按实例内存状况提示。

### 5.3 记录项

- Oracle 预览新增「无排序预览」提示，解决上轮“从 ID 133 开始”的困惑。
- V$SESSION 无权限时监控仅显示对象统计并给出提示（设计如此）。
- 5000 项 IN 在 Oracle 23ai 可执行；MariaDB 不支持 `VALUES ROW` 与 `->>`；PostgreSQL 16 不支持 `JSON_TABLE`。
- 本次为适配本地沙箱，18080 后端进程从 `%TEMP%` 目录运行当前构建（工作区内二进制被沙箱限制写入用户状态目录，非产品问题）。

## 6. 清理

- 临时连接（回归-MySQL8.4/8.0、MariaDB10.11、PG16、Redis 7.4/6.2、OracleFree/System/XE、probe）与“测试临时”及乱码空分组已全部删除；用户原有连接与分组保持不变。
- 本次新增的 CUSTOMERS 数据页和查询 3 页签已关闭，工作区恢复为原有的 `qianguanguan · 查询 1`、`0 · 查询 2` 两个页签。
- 本次启动的 MySQL、MariaDB 10.11、PG16、Redis 7.4/6.2 与 Oracle XE 已停止；初始的 MariaDB 11.4、PG17、Oracle Free、GreptimeDB 及用户 mysql/redis 容器保持运行，数据卷保留。
- 证据：`.test-runtime/global/oracle-matrix.json`、`engines.json`、`oracle-run.log`。