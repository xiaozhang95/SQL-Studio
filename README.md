# SQL Studio

本地数据库工作台，支持 MySQL、MariaDB 和 PostgreSQL 的连接管理、查询、表结构设计与数据编辑。

项目显示名称统一为 **SQL Studio**，仓库目录为 `SQL-Studio`。各模块目录、项目标识和 skill 使用相同名称：

| 模块 | 目录                  | 项目标识                           | skill                 |
| ---- | --------------------- | ---------------------------------- | --------------------- |
| 前端 | `sql-studio-frontend` | npm package：`sql-studio-frontend` | `sql-studio-frontend` |
| 后端 | `sql-studio-backend`  | Go module：`sql-studio-backend`    | `sql-studio-backend`  |
| 桌面 | `sql-studio-electron` | npm package：`sql-studio-electron` | 项目级 `sql-studio` |

项目级 skill 为 `sql-studio`；后端唯一程序入口为 `sql-studio-backend/main.go`。

内置[数据库 Agent](docs/AGENT.md)：从工作台顶部“AI 助手”进入，使用 Ant Design X 聊天界面与 DeepSeek 工具调用；与 SQL Studio 同一前端、Go module、进程和端口，共享连接、主题及 AI 配置。默认只读，完全访问模式下的新增、修改及非删除结构操作逐次确认。

## 功能

- 连接分组、连接测试、TLS 配置及密码加密保存。
- 数据库与表浏览，表可展开字段和索引；支持新建、设计、重命名、删除及刷新。
- 查询编辑、语法高亮、字段补全、多语句执行与执行历史。
- 结果分页、筛选、刷新和 CSV 导出。
- 表数据新增与编辑，暂存修改后统一保存。
- 查看建表语句，转储结构或结构和数据。
- 亮色、暗色和跟随系统主题，支持简体中文与 English 界面。
- 用户主目录下的 `~/.sql-studio/state/` 保存布局、页签、查询草稿、结果快照与历史。
- DeepSeek SQL 续写、优化与可选模型配置，生成后由用户决定是否运行。

## 安装与启动

需要 Node.js 22.12 或更高版本、pnpm、Go 1.26 或更高版本。连接数据库时使用可访问的 MySQL、MariaDB 或 PostgreSQL 实例。

安装依赖：

```sh
cd sql-studio-frontend
pnpm install --frozen-lockfile
cd ../sql-studio-backend
go mod download
```

在两个终端中分别启动：

```sh
# 后端（仓库根目录执行）
cd sql-studio-backend
go run main.go
```

```sh
# 前端（仓库根目录执行）
cd sql-studio-frontend
pnpm dev
```

浏览器打开 `http://127.0.0.1:15173`，点击“新建连接”填写数据库信息。后端默认监听 `127.0.0.1:18080`。

## Electron 调试与打包

桌面项目位于 [sql-studio-electron](sql-studio-electron/README.md)。调试时先按上面的命令手动启动 Go 和 Vite，再到 Electron 目录执行 `pnpm start`。

从仓库根目录分别安装前端和桌面项目依赖，再在桌面项目打包。

```sh
cd sql-studio-frontend
pnpm install --frozen-lockfile
cd ../sql-studio-electron
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` 一次完成前后端构建和桌面打包，将后端程序和网页资源一起分发。产物位于 `sql-studio-electron/release/`；Windows 为绿色版目录和全局 NSIS 安装包，macOS 为 DMG，Linux 为 AppImage。请在目标平台构建。发行版管理自己的 Go 服务和空闲端口，默认配置路径为 `~/.sql-studio/state/`。绿色版须保留整个目录后运行其中的 `SQL Studio.exe`。

### 启动失败与配置保存提示

默认配置目录为 `~/.sql-studio/state/`，首次启动时创建。`open ...\.state-*.tmp: Access is denied` 表示处理保存请求的后端进程被系统拒绝创建临时文件。

先确认浏览器连接的后端：程序启动日志会输出 PID、可执行文件路径、监听地址及配置目录。开发时若 18080 已有 `go run` 的临时 main.exe，新服务会因端口占用退出，浏览器仍然访问旧服务；先正常停止旧服务再启动。也可通过 SQLDESK_ADDR 指定其他监听地址，并同步前端代理配置。Electron 打包版使用自己的空闲端口。

若原目录仍出现写入拒绝，保存错误会附带实际服务进程的 PID 和 exe 路径，用于区分旧服务、受限运行环境或系统拦截。程序保持原配置与原目录，不修改 ACL、不增加启动强制写入检查、不自动切换目录。所有服务进程退出后再重新打开，避免多个后端同时写同一目录。

## 使用

1. 新建并测试连接，展开左侧连接查看数据库和表。
2. 新建查询，选择连接和数据库，输入语句后点击“运行”；也可选中部分内容运行，快捷键为 Ctrl/Command+Enter。
3. 右键表选择“打开表”查看数据。双击单元格编辑，或点击“新增行”填写新记录，通过顶部“保存”统一提交。
4. “放弃修改”清空尚未提交的更改；已有暂存修改时，需先保存或放弃再刷新。
5. 在消息、摘要及结果标签之间切换查看执行情况；执行历史可搜索、复制并载入当前查询。

MySQL/MariaDB/PostgreSQL SQL 窗口均支持查询、建表、插入、修改、删除等语句，点击运行或使用快捷键直接执行，不设置只读开关；库表管理、数据新增和编辑通过对应操作显式提交。多语句顺序执行，失败或取消停止后续语句；已完成的写入不会因此自动回滚。各语句不共享事务或 SET 会话状态。

## 本机配置

默认保存到用户主目录下的 `~/.sql-studio/state/`：

- `workspace-index.json` 保存布局、页签和内容引用，`workspace-parts/` 保存按散列寻址的查询草稿和结果。
- `history.json`：按连接保存的执行历史。
- `appearance.json` 保存主题和界面字号。

配置采用带版本号和修订号的 JSON 格式，可通过 `SQLDESK_STATE_DIR` 指定目录。配置文件缺失时使用默认布局并重新生成，不再读取浏览器旧记录。恢复页面不会自动执行查询。

连接与加密密钥默认也保存在 `~/.sql-studio/state/`，连接接口不返回密码。备份连接时需同时保管 `connections.json` 与 `master.key`。界面配置可能包含查询文本和结果。

## 使用范围

仅面向本机单用户，默认不对外提供网络服务。

普通查询默认最多返回 1000 行，最大 5000 行，字段内容上限约 8 MiB，最长 30 秒。结果筛选和 CSV 导出针对已加载结果。库、Schema 和表菜单的“结构和数据”转储通过专用接口分批读取，限制见 [SQL 转储](docs/DATABASES.md#sql-转储)。视图及无完整主键的已有记录不支持直接编辑，生成列和部分特殊字段由数据库处理。

项目维护：[文档索引](docs/README.md) · [项目框架](docs/ARCHITECTURE.md) · [接口列表与 Swagger](docs/API.md)

使用说明：[数据库连接](docs/DATABASES.md) · [用户配置格式](docs/USER_STATE.md)

测试数据：根目录 `sql/` 仅包含 [MySQL](sql/mysql.sql)、[MariaDB](sql/mariadb.sql)、[PostgreSQL / PolarDB](sql/postgresql.sql) 三份完整 demo。每份依次创建 `sql_studio_demo` 库、4 张业务表，并通过多行 `INSERT ... VALUES` 和 `INSERT ... SELECT` 批量插入 21,100 行虚构数据（客户 1,000、商品 100、订单 5,000、明细 15,000），最后展示行数与金额校验结果。

在仓库根目录选择对应引擎执行一条命令即可，地址、端口和用户名按实际连接修改，密码由客户端提示输入：

```sh
# MySQL
mysql --host=127.0.0.1 --port=3306 --user=root --password --default-character-set=utf8mb4 < sql/mysql.sql

# MariaDB（这里使用本机开发映射端口 3307，默认服务端口通常为 3306）
mariadb --host=127.0.0.1 --port=3307 --user=root --password --default-character-set=utf8mb4 < sql/mariadb.sql

# PostgreSQL / PolarDB PostgreSQL
psql -X --host=127.0.0.1 --port=5432 --username=postgres --dbname=postgres --file=sql/postgresql.sql
```

需要建库权限；目标库已存在时脚本报错停止，不自动覆盖。PostgreSQL 文件包含 [`psql` 的 `\connect` 命令](https://www.postgresql.org/docs/current/app-psql.html)，用于建库后自动切换连接，请通过上面的 `psql` 命令执行完整文件。MySQL/MariaDB 可通过命令行或 SQL Studio 执行整个文件；多语句不会整体回滚，出错时需检查已完成的部分。

默认状态目录为 `~/.sql-studio/state/`，Windows 为 `%USERPROFILE%\.sql-studio\state`。`SQLDESK_STATE_DIR` 可覆盖状态目录，`SQLDESK_DATA_DIR` 可单独指定连接目录。显式相对路径以启动工作目录为基准。

旧数据保留在原目录。如需沿用，退出应用和服务后，将选定的旧 `state/` 整体复制到尚无数据的新位置，包括密钥和工作区分片。
