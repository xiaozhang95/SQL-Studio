# SQL Studio

本地数据库工作台，支持 MySQL、MariaDB、PostgreSQL、Oracle、GreptimeDB 和 Redis。各引擎的连接、查询、对象管理和导出能力见 [数据库说明](docs/DATABASES.md)。

项目显示名称统一为 **SQL Studio**，仓库目录为 `SQL-Studio`。各模块目录、项目标识和 skill 使用相同名称：

| 模块 | 目录                  | 项目标识                           | skill                 |
| ---- | --------------------- | ---------------------------------- | --------------------- |
| 前端 | `sql-studio-frontend` | npm package：`sql-studio-frontend` | `sql-studio-frontend` |
| 后端 | `sql-studio-backend`  | Go module：`sql-studio-backend`    | `sql-studio-backend`  |
| 桌面 | `sql-studio-electron` | npm package：`sql-studio-electron` | 项目级 `sql-studio` |

项目级 skill 为 `sql-studio`；后端唯一程序入口为 `sql-studio-backend/main.go`。

内置[数据库 Agent](docs/AGENT.md)：从左侧导航的「AI 助手」进入，使用 Ant Design X 聊天界面与 DeepSeek 工具调用；与 SQL Studio 同一前端、Go module、进程和端口，共享连接、主题及 AI 配置。默认只读，完全访问模式下的新增、修改及非删除结构操作逐次确认。

左侧全局导航提供「监控指标」和「同步数据库」入口。支持对应功能的连接也可从右键菜单打开，监控带入所选连接，同步将其作为源连接。监控页可手动刷新，也可选择自动刷新间隔。MySQL、MariaDB 和 Redis 显示实例统计，PostgreSQL 和 GreptimeDB 可切换数据库，Oracle 显示当前服务的 Schema 对象和可见会话。各引擎共用指标概览、趋势和分类状态，趋势仅记录当前页面的实际采样。

## 功能

- 连接分组、连接测试、TLS 配置及密码加密保存。
- Redis 单机、哨兵和集群连接，支持键浏览、命令行、实时订阅及监控。
- 数据库与表浏览，表可展开字段、索引和外键（MySQL、MariaDB、PostgreSQL、Oracle），支持按引擎新建、设计、重命名、删除及刷新。
- 查询编辑、语法高亮、字段补全、多语句执行与执行历史。
- 结果、消息、摘要和执行历史连续虚拟滚动。结果支持筛选、刷新及 CSV、Excel、JSON 导出。
- 表数据新增与编辑，暂存修改后统一保存。
- 查看建表语句，转储结构或结构和数据。
- 亮色、暗色和跟随系统主题，支持简体中文与 English 界面。
- 用户主目录下的 `~/.sql-studio-dev/state/`（开发）或 `~/.sql-studio/state/`（发行）保存布局、页签、查询草稿、结果快照与历史。
- DeepSeek SQL 续写、优化与可选模型配置，支持逐个测试模型连接。生成的 SQL 由用户决定是否运行。

## 安装与启动

需要 Node.js 22.12 或更高版本、pnpm、Go 1.26 或更高版本。新建连接时使用可访问的数据库实例。

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

「系统设置 → 关于软件」显示当前版本，网页和桌面打包共用 [前端 package.json](sql-studio-frontend/package.json) 的 `version`。桌面端可检查 GitHub 正式版，Windows NSIS 安装版可在应用内下载更新。左侧主题分隔线上方持续显示下载进度，校验完成后可点击图标重启安装。发版步骤见 [GitHub Release 与更新](sql-studio-electron/README.md#github-release-与更新)。

### 启动失败与配置保存提示

开发默认配置目录为 `~/.sql-studio-dev/state/`，发行版为 `~/.sql-studio/state/`，首次启动时创建。`open ...\.state-*.tmp: Access is denied` 表示处理保存请求的后端进程被系统拒绝创建临时文件。

先确认浏览器连接的后端：程序启动日志会输出 PID、可执行文件路径、监听地址及配置目录。开发时若 18080 已有 `go run` 的临时 main.exe，新服务会因端口占用退出，浏览器仍然访问旧服务；先正常停止旧服务再启动。也可通过 SQLDESK_ADDR 指定其他监听地址，并同步前端代理配置。Electron 打包版使用自己的空闲端口。

若原目录仍出现写入拒绝，保存错误会附带实际服务进程的 PID 和 exe 路径，用于区分旧服务、受限运行环境或系统拦截。程序保持原配置与原目录，不修改 ACL、不增加启动强制写入检查、不自动切换目录。所有服务进程退出后再重新打开，避免多个后端同时写同一目录。

## 使用

1. 新建并测试连接，展开左侧连接查看数据库和表。
2. 新建查询，选择连接和数据库，输入语句后点击“运行”；也可选中部分内容运行，快捷键为 Ctrl/Command+Enter。
3. 右键表选择“打开表”查看数据。双击单元格编辑，或点击“新增行”填写新记录，通过顶部“保存”统一提交。
4. “放弃修改”清空尚未提交的更改；已有暂存修改时，需先保存或放弃再刷新。
5. 在消息、摘要及结果标签之间切换查看执行情况。可从执行历史载入 SQL 到当前查询。

SQL 窗口按所选引擎执行查询、DDL 和 DML。点击运行或使用快捷键直接执行。MySQL、MariaDB、PostgreSQL 和 Oracle 的多语句在同一会话顺序执行。失败或取消会停止后续语句，已提交写入保留。MySQL 和 MariaDB 支持 `DELIMITER`，Oracle 支持用单独一行的 `/` 分隔 PL/SQL。GreptimeDB 默认使用 MySQL 线协议端口 4002 和维护库 `public`。

## 本机配置

开发默认保存到用户主目录下的 `~/.sql-studio-dev/state/`，打包发行版保存到 `~/.sql-studio/state/`：

- `workspace-index.json` 保存布局、页签和内容引用，`workspace-parts/` 保存按散列寻址的查询草稿和结果。
- `history.json`：按连接保存的执行历史。
- `appearance.json` 保存主题、界面字号和语言。

配置采用带版本号和修订号的 JSON 格式，可通过 `SQLDESK_STATE_DIR` 指定目录。配置文件缺失时使用默认布局并重新生成，不再读取浏览器旧记录。恢复页面不会自动执行查询。

连接与加密密钥也保存在所选环境的 `state/` 中，连接接口不返回密码。备份连接时需同时保管 `connections.json` 与 `master.key`。界面配置可能包含查询文本和结果。

## 使用范围

仅面向本机单用户，默认不对外提供网络服务。

普通查询默认最多返回 1000 行，最大 5000 行，字段内容上限约 8 MiB，最长 30 秒。查询结果支持导出已加载的筛选结果或选中行，格式为 CSV、Excel、JSON。库、Schema 和表菜单的“结构和数据”转储通过专用接口分批读取，限制见 [SQL 转储](docs/DATABASES.md#sql-转储)。视图及无完整主键的已有记录不支持直接编辑，生成列和部分特殊字段由数据库处理。

项目维护：[文档索引](docs/README.md) · [项目框架](docs/ARCHITECTURE.md) · [接口列表与 Swagger](docs/API.md)

使用说明：[数据库连接](docs/DATABASES.md) · [用户配置格式](docs/USER_STATE.md)

本地测试库的 Compose 配置和初始化脚本分别位于各数据库目录。在仓库根目录可运行 `docker compose -f sql/mysql/docker-compose.yml up -d` 启动并初始化 MySQL。测试密码为 `00000000`，Redis 使用免密码连接。其他引擎、端口和兼容版本见 [本地测试数据库](sql/README.md)。

`go run main.go` 默认使用开发目录 `~/.sql-studio-dev/state/`，桌面打包版使用 `~/.sql-studio/state/`；Windows 在 `%USERPROFILE%` 下使用对应目录。`SQLDESK_ENV=development|production` 可显式选择 Go 环境，`SQLDESK_STATE_DIR` 可覆盖状态目录，`SQLDESK_DATA_DIR` 可单独指定连接目录。显式相对路径以启动工作目录为基准。

旧数据保留在原目录。如需沿用，退出应用和服务后，将选定的旧 `state/` 整体复制到尚无数据的新位置，包括密钥和工作区分片。
