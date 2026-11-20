# SQL Studio 全流程回归报告（2026-11-19）

## 修复后复测（最新，基于 a7170c9）

已修复并复测通过：

- 请求体超限：单语句 1.1MB/2MB、PG 1.1MB、批次 33MB 均返回本地化 413“请求体超过大小上限（1 MiB/32 MiB）”；UI 在发送前拦截，不再出现原始 `http: request body too large` 或“后端服务不可用”。
- Redis 命令上限：60KB 成功；65KB 返回“Redis 命令超过 64 KiB 上限。”
- MySQL 5.7 超 `max_allowed_packet`：单语句与“成功语句 + 超限语句”批次均稳定归一化为“SQL 数据包超过 MySQL/MariaDB 的 max_allowed_packet 限制：Error 1153…”，连续 5 次一致。
- 取消：消息页显示“执行已取消”，历史 `cancelled=true`，取消后可继续执行。
- 核心 SQL：MySQL/PG 精确值、选区 Ctrl+Enter、失败停止（后续 1 条未执行）、PG RETURNING 均通过。

仍未解决 / 新观察：

- MariaDB 20MB 超 packet：5 次中 4 次仍为 `driver: bad connection`，仅 1 次归一化；`queryError` 未覆盖 `driver.ErrBadConn` 类错误。
- 单条 >1MiB 语句仍不能执行，仅提示已明确；长单语句未改走 32MiB 批次。
- 9MB 单结果仍为 `truncated=true`、`rowCount=0`、整行丢弃，未改。
- 语句错误详情不再自动展开，需点击“语句 N”查看；失败摘要可直接看到。
- `pnpm format:check` 仍失败：108 个文件需格式化（此前 123 个）。

自动化：前端真实 SQL 窗口集成 52/52；Node 测试 220 通过/3 跳过；lint 39 通过；后端 MySQL/PG 集成 PASS；`go test ./...`、`go vet ./...`、`go build ./...` 通过；前端 `pnpm build` 成功。

## 环境

- 前端：当前 master 源码构建产物；后端：独立实例 `127.0.0.1:18089`，独立状态目录；未触碰用户已有服务。
- 第一轮 UI 全流程（MySQL/MariaDB/PostgreSQL/Redis + Agent）见后文；第二轮新增多版本与长 SQL 压测。
- 第二轮容器：MySQL 8.4.10 / 8.0.46 / 5.7.44，MariaDB 11.4.13 / 10.11.19，PostgreSQL 16.16 / 13.23 / 17.12，PolarDB PostgreSQL 17.11.1.0，Redis 6.2.24 / 7.4.12。
- 全部为临时容器、临时库/schema、临时连接；结束时已删除。

## 多版本方言矩阵

| 能力 | MySQL 8.4/8.0 | MySQL 5.7 | MariaDB 11.4/10.11 | PG 17 | PG 16 | PG 13 | PolarDB 17 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CTE / 窗口函数 | 支持 | 不支持（语法错误，按预期失败） | 支持 | 支持 | 支持 | 支持 | 支持 |
| JSON_TABLE | 支持 | 不支持 | 支持 | 支持 | 不支持 | 不支持 | 支持 |
| VALUES 表构造 | 支持（ROW 语法） | 不支持 | 支持（标准 `(VALUES (1),(2)) AS t`） | - | - | - | - |
| INSERT/DELETE RETURNING | 不支持（语法错误） | 不支持 | 支持 | 支持 | 支持 | 支持 | 支持 |
| MERGE | - | - | - | 支持 | 支持 | 不支持（语法错误） | 支持 |
| ANY_VALUE | - | - | - | 支持 | 支持 | 不支持 | 支持 |
| pg_stat_io | - | - | - | 支持 | 支持 | 不支持 | 支持 |
| CHECK 约束 | 强制执行 | 接受但忽略 | 强制执行 | - | - | - | - |
| utf8mb4_0900_ai_ci | 支持 | 不支持 | 11.4 支持，10.11 不支持 | - | - | - | - |
| EXPIRETIME / FUNCTION | - | - | - | - | - | - | - |
| Redis 6.2 / 7.4 | - | - | - | - | - | - | Redis 7.4 支持，6.2 明确报 unknown command |

版本差异错误均由后端原样返回，未出现错误版本误判或跨版本结果错乱。

## 长 SQL / 大批次结果

### MySQL / MariaDB

- `query-batch` 语句数：100 条 50ms、1000 条 224ms、5000 条 924ms、10000 条 2116ms，全部 100% 成功；10001 条在发送前以“SQL 批次需要 1 至 10000 条语句”拒绝。
- 单语句长度（批次通道）：1MB 33ms、8MB 202ms、16MB 386ms、30MB 635ms 均成功；33MB 因 32MiB JSON 上限返回 400 `http: request body too large`。
- 单语句（单请求通道）：900KB 成功；1.1MB 因普通请求 1MiB 上限失败。
- UI 批量：一次粘贴 1000 条语句执行约 0.7s，完成到“结果 1000”。
- MySQL 5.7 `max_allowed_packet=4MB`：5MB 语句失败；MariaDB 11.4 `max_allowed_packet=16MB`：16MB、20MB 语句失败。
- 结果大小：1/7/8MB 单元格完整返回；9MB 时 `truncated=true`、`rowCount=0`、行被整体丢弃；UI 1MB 单元格可正常渲染。

### PostgreSQL

- 单请求（每个语句）：900KB SQL 成功，1.1MB 失败（1MiB 上限）。
- 两条各 900KB 的语句分别请求，均成功。
- 300 条短语句 API 顺序执行约 4.5s（约 15ms/条）；UI 100 条约 3.9s。
- 结果 1/7/8MB 完整；9MB `truncated=true` 且行为空。

### Redis

- 单命令上限 64KiB：60KB `SET` 成功；65KB/70KB 返回“请输入一条有效的 Redis 命令”。
- 通过底层写入 200KB 值后，应用 `GET` 返回约 128KiB 预览并标记 `truncated=true`。
- 1000 条 `SET` 顺序执行约 14.2s，`DBSIZE=1000` 正确。
- 10,000 个键扫描：API 100 页约 1.3s；UI 每点一次“扫描下一页”增加 100 个键，1 万键需大量点击。
- 键详情（类型/字节数/TTL）、Redis 7.4 `FUNCTION LIST`、Redis 6.2 明确 unknown command、两个版本 Pub/Sub 消息投递、Redis 7.4 监控页均通过。

### 持久化与恢复

- 2MB 双语句 MySQL 草稿与两个结果在刷新后完整恢复，未自动重跑。
- 历史保存 2MB 和 5MB SQL 原文（状态文件约 11MB）；每连接仅保留最新 50 条，属既有上限。

### 并发与取消

- MySQL 与 PostgreSQL 均验证 4 个查询槽：5 个并发 `SLEEP(2)`/`pg_sleep(2)` 中 1 个返回 429，随后查询正常。
- 1000 条 `SLEEP(0.02)` 长批次在约 0.75s 后取消，仅收到 1 条语句，随后 `SELECT 7` 成功，锁已释放。

## 问题与观察

1. **中高：长单语句在 UI 中超过 1MiB 直接失败。** MySQL/MariaDB 单语句走 `/query`（1MiB），多语句才走 32MiB 批次；因此 2MB 单语句失败，但“`SELECT 1;` + 2MB 语句”可成功。错误提示为未本地化的 `http: request body too large`；首次 2MB 测试还曾显示“后端服务不可用，请检查 Go 服务是否已启动…”，属误导性提示（后续复测未重现）。建议对超限给出明确、本地化的错误，或让长单语句也走批次通道。
2. **中：packet 超限错误不稳定。** MySQL 5.7 单语句可显示 `Error 1153 ... max_allowed_packet`，但带前一条成功语句时 API 返回 `invalid connection`；MariaDB 20MB 返回 `driver: bad connection`。同一类问题错误文案不一致，需归一化。
3. **低：Redis 超长命令提示不准确。** >64KiB 命令返回“请输入一条有效的 Redis 命令”，用户无法知道是长度限制；60KB 可正常执行。
4. **行为观察：>8MiB 单结果被整体丢弃。** 9MB 结果返回 `truncated=true` 但 `rowCount=0`、`rows=[]`，仅保留列信息；若期望“保留部分内容/行并标记截断”，需确认产品预期。
5. **性能观察：PostgreSQL 长脚本逐条 HTTP 请求，约 15ms/条；MySQL 批次 1000 条约 0.7s。** 长 PG 脚本（数百条）明显更慢。
6. **首轮遗留问题**：取消执行后消息页签仍标“执行失败”（MySQL 显示“耗时未记录”）；`pnpm format:check` 报 123 个既有文件格式问题；内置浏览器表面不可见导致真实指针/截图受限（本轮仍通过强制布局 + DOM 事件 + 真实后端验证）。

## 未覆盖

- TLS/证书、真实下载与结果 CSV 导出菜单点击、上传导入 >1MiB、8MiB 导出停止边界、完整 30 秒超时、macOS Command 快捷键、Redis Key 编辑 768KB 上限、MariaDB 超 packet 的 UI 文案、PolarDB 专有扩展。

## 清理核验

- 11 个测试容器已删除；所有 `vlab_*` 库/schema 与 Redis 数据已清理。
- 11 个测试连接已删除，连接列表 0，仅剩“默认分组”。
- 独立后端停止，18089 与所有测试端口无监听；临时状态目录与夹具已删除。
- `git status` 无源码改动。
