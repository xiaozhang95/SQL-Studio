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

- `SQL Studio-Portable-<版本>-<架构>.zip` 完整解压到可写目录后，双击 `SQL Studio.exe`。
- `SQL Studio-Setup-<版本>-<架构>.exe` 为所有用户安装。安装时需通过 Windows 管理员授权，默认目录为 `%ProgramFiles%\SQL Studio`，安装时可修改。安装后可从桌面、开始菜单或安装目录打开 `SQL Studio.exe`。

安装器按路径检查并请求关闭安装目录中的 SQL Studio 进程，再替换旧卸载程序。覆盖安装和卸载保留用户配置。旧安装目录中已有的 `.sql-studio` 保留在原位置。

### Windows 构建与启动排查

`pnpm build` 出现 `EBUSY` 且报错路径指向 `app.asar` 时，先关闭运行中的打包版及持有该文件的进程。需要使用新输出目录时，在 PowerShell 设置 `$env:SQL_STUDIO_OUT = 'release-ok'` 后运行 `pnpm build`。

启动诊断日志写入 `<数据根>/state/electron.log`。如果数据目录无法初始化，弹窗和启动终端会显示失败的路径及系统错误，可用 `SQL_STUDIO_DATA_DIR` 指定可写路径。如果 Electron 在主进程入口执行前以 `STATUS_BREAKPOINT`（`0x80000003`）退出，可能没有这份启动日志。

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

Windows 调试遇到 `STATUS_BREAKPOINT`（`0x80000003`）或访问冲突（`0xC0000005`）时，会从系统临时目录的 Electron 副本重试，继续连接同一套开发服务。重试沿用同一个数据目录，退出后清理运行时副本。临时运行时仍以相同方式退出时，会带 `--no-sandbox` 再试一次。Windows 打包版的 `SQL Studio.exe` 遇到这两个退出码时直接带 `--no-sandbox` 重试。

窗口配置关闭 Node 集成并启用 contextIsolation、sandbox 和 webSecurity。传入 `--no-sandbox` 时关闭 Chromium 沙箱。preload 仅提供只读标题栏高度和主题同步接口，不暴露通用 IPC。主进程校验调用来源和颜色；拒绝外部导航、新窗口、webview 和页面权限请求。API 仍是后端原有的本机单用户 HTTP 服务。

## 代码与检查

- `src/main.mjs`：窗口、单实例与应用生命周期。
- `src/backend.mjs`：本地服务启动、就绪等待与子进程清理。
- `src/policy.mjs`：导航边界与后端环境隔离。
- `src/preload.cjs`：最小标题栏主题桥接。
- `src/startup/`：不依赖 Go 服务的本地全窗口启动动画及视图清理。
- `scripts/`：Electron 镜像启动入口、桌面资源构建。
- `scripts/windows/`：Windows GUI 启动入口及 NSIS 安装、升级和卸载逻辑。
- `electron-builder.cjs`：应用与安装包配置。
- `tests/`：导航、配置隔离与健康检查契约测试。

```sh
node --test tests/*.test.mjs
```

这些 Node 测试使用临时 HTTP 服务，不访问数据库；不能替代真实窗口、安装包或 SQL 回归。
