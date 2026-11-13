# SQL Studio Electron

独立的桌面壳项目，与 `sql-studio-frontend`、`sql-studio-backend` 同级，单独管理依赖和锁文件。复用现有 React 工作台与 Go HTTP API，不复制前后端源码、不改变网页运行方式。

## 安装依赖

需要 Node.js 22.12+、pnpm、Go。首次分别安装前端与本项目依赖：

```sh
cd sql-studio-frontend
pnpm install --frozen-lockfile
cd ../sql-studio-electron
pnpm install --frozen-lockfile
```

## 调试与打包

在 `sql-studio-electron` 目录执行。

| 命令 | 用途 |
| --- | --- |
| `pnpm start` | 连接已运行的 Vite 和 Go 服务，打开 Electron 调试窗口。 |
| `pnpm build` | 构建当前前后端并打包，产物写到 `release/`。 |

调试时，在 `sql-studio-backend` 目录手动执行 `go run main.go`，在 `sql-studio-frontend` 目录手动执行 `pnpm dev`，最后在本目录执行 `pnpm start`。Electron 检查 `http://127.0.0.1:15173` 上的 Vite 服务和它转发到 Go `127.0.0.1:18080` 的 `/api/health`。检查失败时，终端和弹窗会提示对应的启动命令。调试窗口直接加载 Vite 提供的前端源码，支持热更新。

打包时只需执行 `pnpm build`。它将前端静态资源和 Go 可执行文件构建到 `build/runtime/`，再通过 `extraResources` 随应用打包。后端可执行文件位于 ASAR 外。

当前命令按宿主平台和架构成套构建，不支持附加 electron-builder 跨平台/跨架构参数；请在目标平台构建，避免 Go 与 Electron 架构不匹配。macOS 产物未签名、未公证，Windows 产物未签名；正式分发需另行配置签名。

Windows 在 `release/` 下生成两份分发产物。

- `win-unpacked/` 为绿色版目录。保留整个目录，双击其中的 `SQL Studio.exe`。目录名随架构变化，例如 `win-arm64-unpacked/`。
- `SQL-Studio-Setup-<版本>-<架构>.exe` 为所有用户安装。安装时需通过 Windows 管理员授权，默认目录为 `%ProgramFiles%\SQL Studio`，安装时可修改。安装后可从桌面、开始菜单或安装目录打开 `SQL Studio.exe`。

安装器按路径检查并请求关闭安装目录中的 SQL Studio 进程，再替换旧卸载程序。覆盖安装和卸载保留用户配置。旧安装目录中已有的 `.sql-studio` 保留在原位置。

### GitHub Release 与更新

「系统设置 → 关于」显示当前版本。Electron 可手动检查 [SQL Studio 的公开 GitHub Releases](https://github.com/xiaozhang95/SQL-Studio/releases)，发现更高的正式版本后可打开对应的下载页。Windows NSIS 安装版在该版本同时包含对应架构的安装包与 `latest.yml` 时，可在应用内下载整个安装包，确认后退出本地 Go 服务并启动安装。绿色版、调试版和其他平台通过 Release 页面下载安装；网页端仅显示构建时的版本号。

1. 修改 [前端 package.json](../sql-studio-frontend/package.json) 的 `version`，在本目录运行 `pnpm build`。Vite 将版本写入网页，electron-builder 将同一个值写入桌面应用元数据，并用于安装包名称和更新清单。
2. 按版本号创建 GitHub Release，例如 `1.0.0`。把 `release/` 下同一次构建的 `SQL-Studio-Setup-1.0.0-x64.exe` 和 `latest.yml` 一起上传，保持生成的文件名，发布为正式版本。一个 Windows 自动更新清单对应同一次构建的安装包；其他架构的包可供手动下载。
3. 已安装 `0.1.1` 的用户先下载新版安装包覆盖安装一次。从带更新功能的版本开始，可在应用内安装后续版本。Windows 安装版升级时可能出现管理员授权提示。

`pnpm build` 生成产物和更新清单，上传在 GitHub Release 页面完成。公开下载无需 GitHub Token。

### Windows 构建与启动排查

`pnpm build` 出现 `EBUSY` 且报错路径指向 `app.asar` 时，先关闭运行中的打包版及持有该文件的进程。需要使用新输出目录时，在 PowerShell 设置 `$env:SQL_STUDIO_OUT = 'release-ok'` 后运行 `pnpm build`。

Windows 发行版的 EXE 启动器将运行路径、退出状态和 Electron 标准错误写入 `<数据根>/state/launcher.log`。主进程的诊断日志位于同目录的 `electron.log`。启动器会在全部启动尝试失败后显示错误和日志路径。数据目录初始化失败时，错误包含实际目录和系统原因。

Windows 打包完成可执行文件编辑后，将生成的应用目录及文件设为普通用户的 Medium 完整性级别。开发工具为工作区设置的 Low 标签会随生成文件继承，使绿色版以低完整性运行，无法写入普通用户配置和临时目录。此步骤限定在生成的应用目录中。

## 标题栏和应用图标

应用先显示[铺满窗口的启动动画](src/startup/README.md)，画面包含数据库 Logo、SQL Studio 名称和三个闪动的圆点。调试版在开发服务检查通过后显示动画，打包版在动画期间启动随包后端。工作台文档及首个标题栏主题消息就绪后，再停留两秒并淡出切换。开屏沿用已保存的主题和系统减少动态效果偏好，动画填满当前窗口。

启动失败时显示错误对话框。启动过程中关闭窗口会取消等待，并清理打包版本次创建的后端进程。

桌面窗口采用隐藏原生标题背景、保留系统窗口按钮的方式。前端共享的 DesktopTitleBar 提供 macOS 24px、Windows/Linux 32px 高拖动区域，和业务 PageHeader 都使用 Ant Design `colorBgContainer`（`--surface`）；亮色、暗色、跟随系统及工作区/AI 助手切换均沿用同一主题。Windows/Linux 窗口按钮背景通过受限 IPC 同步，macOS 红黄绿按钮位于 x=12/y=6，与缩短的标题栏一起布局。系统级菜单栏仍由操作系统管理。

浏览器与 Electron 共用业务顶栏，最小高度由 Ant Design `controlHeight + paddingSM` 决定。AI 助手隐藏最上方的 SQL Studio 应用名，业务 header 中的会话标题继续保留。

工作区最上方标题随活动页联动，例如 `sql_studio_demo · 查询 2`，复用页签完整标题；切库、切页同步，空工作区显示 SQL Studio。渲染页面的 document.title 同时同步系统窗口标题，后台工作台不覆盖 AI 页状态；AI 页仍隐藏最上方标题。

图标唯一来源是 [studio.svg](../sql-studio-frontend/public/studio.svg)，由主题绿色渐变底、数据库圆柱与查询光标组成。开发时直接在内存渲染。`pnpm build` 通过 `scripts/icons.mjs` 生成 `build/icons/icon.png`，electron-builder 据此生成平台图标。网页 favicon、开屏、窗口、macOS Dock 和安装包使用同一 Logo。

macOS 单独生成带透明安全区的 `build/icons/mac-icon.png`：在 1024px 画布内居中放置 824px 图形，四周各留 100px，与本机 Chrome/终端图标的可见比例一致。打包版由 macOS 使用应用自带 ICNS，不在运行时覆盖 Dock 图标；开发预览才用带留白的 PNG 替换 Electron 默认图标。开屏、网页和其他平台继续使用未缩小的图标。

## Electron 镜像

项目 `.npmrc` 配置 npm registry 与二进制下载镜像：

```ini
registry=https://registry.npmmirror.com/
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

`scripts/electron.mjs` 在启动 Electron 前显式设置 `ELECTRON_MIRROR`，确保 Electron 首次按需下载也走镜像；`electron-builder.cjs` 配置 `electronDownload.mirror` 与 `ELECTRON_BUILDER_BINARIES_MIRROR`，覆盖打包下载。可通过同名环境变量覆盖镜像。保留正常 TLS 与校验和验证。

## 进程与配置

桌面调试使用手动启动的 Vite 和 Go 服务，关闭 Electron 后，开发服务继续运行。打包版自动选择 `127.0.0.1` 空闲端口，启动随包 Go 服务，等待 `/api/health` 就绪后加载同源网页。关闭最后一个窗口即退出，打包版会清理自己创建的 Go 子进程。macOS/Linux 最多等待 6 秒，Windows 使用系统进程终止语义。

桌面页面使用 `/` 和 `/agent` 历史路由，页面内切换不整页加载。窗口的同源导航规则允许这两条路径；打包版刷新 `/agent` 时，由随包 Go 服务提供同一份页面入口。

桌面调试、绿色版和安装版默认都使用当前用户主目录下的 `.sql-studio/`，Windows 路径为 `%USERPROFILE%\.sql-studio`，macOS 和 Linux 路径为 `~/.sql-studio/`。

- `state/` 保存连接、密钥、工作区及 AI 配置，与独立运行的 Go 服务共用默认路径。
- `electron/` 保存 Electron 和 Chromium 自身数据。

打包版为随包后端指定网页、连接和状态目录，并隔离终端里的 `SQLDESK_*` 初始数据库参数。调试时，Go 使用开发者启动服务时的配置。同一个状态目录应由一个 Go 服务进程使用。如需迁移旧配置，在退出应用和服务后将旧 `state/` 整体复制到尚无数据的新位置，包括 `master.key` 和工作区分片。

需要换一个数据根时，用 `SQL_STUDIO_DATA_DIR` 指定绝对路径或相对启动目录的路径，`state/` 与 `electron/` 都会建在它下面。调试时如需共享自定义目录，在启动 Go 服务时也将 `SQLDESK_STATE_DIR` 和 `SQLDESK_DATA_DIR` 指向该目录下的 `state/`。

```sh
SQL_STUDIO_DATA_DIR=./.data pnpm start
```

```powershell
$env:SQL_STUDIO_DATA_DIR="D:\sql-studio-data"; pnpm start
```

Windows 调试遇到 `STATUS_BREAKPOINT`（`0x80000003`）或访问冲突（`0xC0000005`）时，会从系统临时目录的 Electron 副本重试，继续连接同一套开发服务。Windows 绿色版和安装版始终从发行目录启动，遇到这两个退出码时带 `--no-sandbox` 重试一次。其他失败由启动器显示原因和日志路径。

窗口配置关闭 Node 集成并启用 contextIsolation、sandbox 和 webSecurity。传入 `--no-sandbox` 时关闭 Chromium 沙箱。preload 提供只读标题栏高度、主题同步和受限的更新方法。主进程校验调用窗口和来源，更新只访问配置的公开 GitHub 仓库；工作台拒绝外部导航、新窗口、webview 和页面权限请求；导出与保存 SQL 走 `save-begin`/`save-commit`/`save-discard` 受限 IPC：begin 先原生选路径、commit 再 Node 写盘，与网页先选位置一致，路径始终由用户选定，不依赖渲染进程 File System Access 权限（`fileSystem` 权限仍仅对本源放行）。API 仍是后端原有的本机单用户 HTTP 服务。

## 代码与检查

- `src/main.mjs`：窗口、单实例、应用生命周期与原生保存（`save-begin`/`save-commit`/`save-discard`）。
- `src/backend.mjs`：本地服务启动、就绪等待与子进程清理。
- `src/policy.mjs`：导航边界、权限判定与后端环境隔离。
- `src/preload.cjs`：标题栏、更新与原生保存桥接。
- `src/updates.mjs`：GitHub 正式版本查询、NSIS 更新下载与安装。
- `src/startup/`：不依赖 Go 服务的本地全窗口启动动画及视图清理。
- `scripts/`：Electron 镜像启动入口、桌面资源构建。
- `scripts/windows/`：Windows GUI 启动入口及 NSIS 安装、升级和卸载逻辑。
- `electron-builder.cjs`：应用与安装包配置。
- `tests/`：导航、权限策略、配置隔离与健康检查契约测试。

```sh
node --test tests/*.test.mjs
```

这些 Node 测试使用临时 HTTP 服务，不访问数据库；不能替代真实窗口、安装包或 SQL 回归。
