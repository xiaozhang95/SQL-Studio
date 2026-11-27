# SQL Studio 功能与多版本 SQL 测试报告

测试日期 **2026-11-27**（北京时间） · 代码 **`53dbd6c`** · Web 版本 **1.5.6**

## 结论

内置浏览器走查了工作台、连接管理、监控、数据库同步、AI 助手及系统设置。实测 **6 种数据库引擎、11 个 Docker 实例**。实库接口主矩阵 **151 项通过**，补充对照和边界检查 **13 项完成**。兼容测试把新旧版本产生的预期差异也列入断言。

发现 **1 类工作台缺陷**，在 MySQL、MariaDB 和 PostgreSQL 的转义模式脚本上复现。原生客户端与 Go 批次接口均能执行同一组 SQL，工作台在发送前误报引号未闭合。另有原样前端测试失败和格式基线告警，见下文。

## 修复后复测 · 1.5.7

- 内置浏览器使用新构建，在 MySQL 8.4.10 / 8.0.46、MariaDB 11.4.13 / 10.11.19 和 PostgreSQL 17.12 / 16.16 上执行下方原始复现脚本。六个版本都返回正确的首个字符串和末条查询值 `7`，草稿保持原样。
- PostgreSQL 16 的选区快捷键只运行选中的三条语句。事务内先启用局部转义，再回滚到保存点，后续查询恢复标准字符串语义。真正缺少结束引号的脚本仍会被拦截。该错误提示在下一次成功执行后仍可见，可手动关闭。
- 前端全量 Node 测试 **241 通过、3 跳过、0 失败**。启用实库窗口编排和 PostgreSQL 管理测试后，**61 项通过**（58 个子项和 3 个父项）。测试替身和 PostgreSQL 端口已在仓库内修正，复跑无需临时加载器。TypeScript、lint、前端构建及本轮改动代码的格式检查通过。全仓使用 `--end-of-line auto` 过滤换行差异后仍有 20 个文件的格式告警。
- 切分器跟踪脚本内可确定的字面量设置。动态赋值、通过函数改设置或受服务器版本条件控制的设置仍由数据库解释。复测使用隔离状态，临时库、Schema 和六条浏览器测试连接均已核对清理。

## 环境与范围

- 现有 Vite `127.0.0.1:15173` 可加载工作台，现有 Go `127.0.0.1:18080/api/health` 返回 200。写入、刷新恢复、同步和 AI 会话操作使用当前源码单独构建的 Web 与 Go，地址 `127.0.0.1:18089`，并使用独立工作区和连接状态。
- 六份 `sql/*/docker-compose.yml` 均通过 `docker compose config -q`。使用 Compose 已有容器及初始化样例，写入限定在本轮临时对象。Windows 环境使用 Node 24.19.0、pnpm 12.5.1、Go 1.26.0。

| 引擎 | 运行版本与端口 | 主矩阵通过 |
| --- | --- | ---: |
| MySQL | 8.4.10 `13306`、8.0.46 `23306` | 32 |
| MariaDB | 11.4.13 `13307`、10.11.19 `23307` | 34 |
| PostgreSQL | 17.12 `15432`、16.16 `25432` | 36 |
| Oracle | Free 23.26.4.0.0 `11521`、XE 21.3.0.0.0 `21521` | 30 |
| GreptimeDB | 1.3.0 `14002` | 5 |
| Redis | 7.4.12 `16379`、6.2.24 `26379` | 14 |
| **合计** | **11 个实例** | **151** |

## 内置浏览器实测

| 场景 | 结果与可观察证据 |
| --- | --- |
| 连接表单 | 检查六种类型的默认端口、必填项和横向布局。Redis 7.4 在表单中测试连接成功并保存，随后在对象树用名称搜索找到。 |
| 对象树与数据 | MySQL 样例表可展开，双击 `orders` 得到 1000 行。筛选无匹配文本后显示 0 条，清空后恢复 1000 条。刷新、结构、DDL、设计页均进入。DDL 显示 `fk_orders_customer`。设计页检查至可编辑表单。 |
| SQL 选区 | MySQL 8.4 和 PostgreSQL 17 的 `Ctrl+Enter` 都仅执行首行选区，三行草稿保留。去掉选区执行生成三个结果。另在 MySQL 用运行按钮执行两行选区，仅得到两个结果。 |
| 失败与取消 | MySQL、PostgreSQL 的缺表语句分别显示 1146、42P01，保留第一条结果并提示剩余一条未执行。主动取消休眠批次后首结果保留，MySQL 执行历史显示已取消，PostgreSQL 可立即重跑并得到 88。 |
| MySQL 写入与长脚本 | 在临时库跑通 `CREATE DATABASE`、`USE`、`SET`、建表、插入和更新。同批 `DATABASE()` 返回临时库名，会话变量返回 42。162 条脚本显示“已处理 162/162，成功 162，错误 0”，最终变量值 160。 |
| MySQL 多结果 | `DELIMITER` 脚本创建临时库内存储过程，单次 `CALL` 显示两个数据集，第二组为 22。10 条查询进入结果集下拉导航，显示第 10 个结果。 |
| PostgreSQL 写入 | 在临时 Schema 执行建表、`INSERT … RETURNING`、`UPDATE … RETURNING` 和美元引号 SQL。更新数据集显示 `已更新;😀`。 |
| 其余引擎及兼容版 | MySQL 8.0、PostgreSQL 16 在工作台执行版本查询。MariaDB 11.4 执行 `JSON_SCHEMA_VALID` 成功，10.11 给出 1305。Oracle 23 和 21 均执行含 Q 引号、匿名块和 `/` 的脚本，最终客户数 1000。GreptimeDB 查询样例指标表成功。 |
| Redis | 7.4 的编辑器脚本返回 `PONG`、`杭州`、Stream 长度 2，独立命令行也返回 `PONG`，订阅可启动及停止。6.2 切换到 DB1，`EXPIRETIME` 报未知命令，保留先完成的 `GET` 结果并停止后续 `PING`。 |
| 结果导出 | 实际下载 CSV 并核对三行、重复 `id` 列、大整数、精确金额和中文。CSV 将 NULL 与空串写为空字段，负数文本按现有公式防护规则加前导单引号。本次只下载了 CSV，另外核对了 Excel、JSON 选项。 |
| 页签与工作区恢复 | 多页溢出后可从“更多”按名称搜索并切换。保存后重载恢复 PostgreSQL 活动页、Schema、草稿及旧结果。`clock_timestamp()` 返回值重载前后相同，查询没有自动重跑。上份报告中未打开连接后无法选库的问题在本轮未复现，选库会在连接加载完成后启用。 |
| 监控 | MariaDB 11.4 显示版本、采样时间、活动趋势与状态信息。关闭自动刷新后，手动刷新成功。其他引擎的指标读取由实库接口矩阵覆盖。 |
| 数据库同步 | 从 MySQL 8.4 临时库同步至 MySQL 8.0 新临时库，检查通过并完成 1 张表、3 行。可从完成页打开目标。再用 Go 接口逐值对比，确认大整数、NULL、空串、精确金额和 Unicode 一致。 |
| AI 助手及系统设置 | AI 会话列表、会话创建、默认只读模式、模型未配置时发送禁用符合预期。设置可切换模型、外观、语言、关于分区，显示版本 1.5.6。窗口宽度 1136 px 时工作台没有整页横向溢出。 |

## SQL 与版本兼容性

主矩阵覆盖初始化行数、元数据、监控、精确值、重复列、Unicode、NULL 与空串、CTE/JOIN/窗口函数、出错停止、批次会话、只读接口边界和流式导出。MySQL、MariaDB、PostgreSQL 和 Oracle 的两代实例均核对样例四表与视图计数 `1000 / 100 / 5000 / 15000 / 5000`。GreptimeDB 核对 8 条指标、4 条事件、2 行视图和 5 行 TQL 结果。Redis 两版核对两个逻辑库、五类数据结构、Lua、错误回执和监控。

| 对照项 | 本轮实测 |
| --- | --- |
| MySQL `SHOW MASTER STATUS` 和 `SHOW BINARY LOG STATUS` | 8.0.46 通过前者，8.4.10 通过后者。另一种写法均返回 1064。 |
| MariaDB `JSON_SCHEMA_VALID` | 11.4.13 的数字型 Schema 返回 `1`，10.11.19 返回 1305。另测 `INSERT/DELETE … RETURNING` 两版均成功。 [MariaDB 函数文档](https://mariadb.com/docs/server/reference/sql-functions/special-functions/json-functions/json_schema_valid) |
| PostgreSQL `JSON_TABLE` | 17.12 返回 `2`，16.16 在 `COLUMNS` 附近返回 SQLSTATE 42601。两版均通过美元引号、嵌套注释、JSONB、BYTEA、显式回滚及批内临时表清理。 |
| Oracle SQL `BOOLEAN`、`IN` 清单 | Free 23 执行 `CASE WHEN TRUE` 得到 7，并通过单组 2200 项 `IN`。XE 21 分别返回 ORA-00920、ORA-01795，拆成 1000/1000/200 三组 `OR` 条件后成功。两版均通过 4000 字节字面值，4001 字节返回 ORA-01704。 |
| Redis `EXPIRETIME` | 7.4 的永久键返回 `-1`，6.2 返回未知命令。两版的 `PUBLISH` 消息均实际送达 NDJSON 订阅。 |
| GreptimeDB | 本轮仓库提供的 1.3.0 实例通过 SQL、TQL、双引号 `USE` 和错误后恢复。覆盖一个版本。 |

长 SQL 和边界检查结果如下。

- 四种关系型数据库的两个版本均通过 96 段 `UNION ALL`、约 180 KiB 注释和行数策略断言。2200 项 `IN` 在 Oracle XE 21 上使用上表所示兼容写法。GreptimeDB 通过 2200 项 `IN`。
- MySQL、MariaDB、PostgreSQL 的六个实例均返回完整 1 MiB 字面量。80 行各 128 KiB 的结果保留 63 行，并标记 `byte-limit`。MySQL 8.4 的单行超限返回 `oversized-row` 和 512 字节预览。
- PostgreSQL 17 超过 32 MiB 的请求返回 413。`pg_sleep(32)` 在约 30.001 秒返回超时，下一条查询成功。MySQL 8.4 占用四个并发槽时，第五条查询返回 429，取消在途批次后恢复。

## 缺陷复现

### 中等影响 · 同一脚本内改变会话转义规则时，工作台拒绝执行

在工作台选中对应连接和库，将下面一段完整粘贴后点击「运行」。浏览器实测复现于 MySQL 8.4.10、MariaDB 11.4.13 和 PostgreSQL 17.12。

MySQL / MariaDB

```sql
SET SESSION sql_mode='NO_BACKSLASH_ESCAPES';
SELECT 'tail\' AS literal_backslash;
SELECT 7 AS later_value;
```

PostgreSQL

```sql
SET standard_conforming_strings=off;
SELECT 'a\'b' AS quoted_value;
SELECT 7 AS later_value;
```

- **实际**　工作台报“SQL 包含未闭合的引号或注释”或“SQL 包含未闭合的引号、美元引号或注释”。整段在发起批次前终止。
- **对照**　六个 MySQL、MariaDB、PostgreSQL 版本的原生客户端与 Go `/query-batch` 均完成三条语句。MySQL/MariaDB 返回 `tail\`、`7`，PostgreSQL 返回 `a'b`、`7`，原生 `psql` 另报非标准转义警告。
- **定位**　工作台在请求创建前调用引擎切分器。MySQL/MariaDB 的切分器默认把反斜杠当作转义，PostgreSQL 的切分器只对 `E` 字符串启用该规则。两边均未随脚本前面的 `SET` 改变行为。受影响的合法脚本包括带会话设置的旧转储或手写迁移脚本。
- **证据**　本次浏览器会话中有错误提示截图，原生客户端和 HTTP 批次对照均复现了预期行值。

## 自动化回归

| 运行项 | 实际结果 |
| --- | --- |
| `go test -count=1 ./...`、`go vet ./...` | 通过。默认未启用的实库用例另行运行。 |
| Go 真实驱动测试 | `TestMySQLIntegration`、`TestMariaDBIntegration`、`TestGreptimeDBIntegration` 全部通过。PostgreSQL 真实覆盖来自内置浏览器和 Go HTTP 接口，其独立 Go 集成固定使用 5432，本轮未单独运行。 |
| 前端原样 `node --test tests/*.test.mjs` | 240 项，236 通过、1 失败、3 跳过。`table-navigation.test.mjs` 的 `new Function` 测试环境缺少 `DatabaseEngine`，实际浏览器的表数据、结构、DDL、设计页面已分别打开。 |
| 前端实库窗口编排与 PostgreSQL 管理 | 原样首轮 48 通过、3 失败，包含失败子项和父项。窗口测试替身缺少 `objects.verifyConnection`，管理套件写死端口 5432。仅在临时测试加载器补齐回调及 Compose 15432 端口后复跑，**59 项通过**，其中 56 个子项、3 个父项。未修改仓库测试文件。 |
| `pnpm lint` 与前端构建 | TypeScript、Oxlint、lint 内 39 项测试及 Vite 生产构建通过。Vite 提示部分 chunk 超过 500 kB。 |
| `pnpm format:check` | 失败，Prettier 报告 212 个现有格式不一致文件。 |

## 覆盖边界与清理

- AI 范围为本地页面及未配置状态。实时模型、完整写入确认链路、数据库 TLS、Redis Sentinel/Cluster、原生 Electron、macOS 快捷键、SQL 文件导入及 Excel/JSON 的完整下载流程未覆盖。
- 测试结束后查询确认 MySQL 临时源库、同步目标库和 PostgreSQL 临时 Schema 均已删除，未发现编排和 PostgreSQL 管理用例留下的临时对象。隔离实例的 12 条本轮连接已删除，连接数回到 0，浏览器测试页已关闭，已读验的 CSV 临时下载已移除。
- 本轮启动的七个测试容器停止，原先运行的数据库容器继续运行。停止隔离 Go 进程并移除本轮临时状态、测试加载器及构建文件。现有同日期报告保留，本次用提交号区分。

