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

| 命令         | 用途                                                   |
| ------------ | ------------------------------------------------------ |
| `pnpm start` | 连接已运行的 Vite 和 Go 服务，打开 Electron 调试窗口。 |
| `pnpm build` | 构建当前前后端并打包，产物写到 `release/`。            |

调试时，在 `sql-studio-backend` 目录手动执行 `go run main.go`，在 `sql-studio-frontend` 目录手动执行 `pnpm dev`，最后在本目录执行 `pnpm start`。Electron 检查 `http://127.0.0.1:15173` 上的 Vite 服务和它转发到 Go `127.0.0.1:18080` 的 `/api/health`。检查失败时，终端和弹窗会提示对应的启动命令。调试窗口直接加载 Vite 提供的前端源码，支持热更新。

打包时只需执行 `pnpm build`。它将前端静态资源和 Go 可执行文件构建到 `build/runtime/`，再通过 `extraResources` 随应用打包。后端可执行文件位于 ASAR 外。

当前命令按宿主平台和架构成套构建，不支持附加 electron-builder 跨平台/跨架构参数；请在目标平台构建，避免 Go 与 Electron 架构不匹配。macOS 产物未签名、未公证，Windows 产物未签名；正式分发需另行配置签名。

Windows 在 `release/` 下生成两份分发产物。

- `win-unpacked/` 为绿色版目录。保留整个目录，双击其中的 `SQL Studio.exe`。目录名随架构变化，例如 `win-arm64-unpacked/`。
- `SQL-Studio-Setup-<版本>-<架构>.exe` 为所有用户安装。安装时需通过 Windows 管理员授权，默认目录为 `%ProgramFiles%\SQL Studio`，安装时可修改。安装后可从桌面、开始菜单或安装目录打开 `SQL Studio.exe`。

安装器按路径检查并请求关闭安装目录中的 SQL Studio 进程，再替换旧卸载程序。覆盖安装和卸载保留用户配置。旧安装目录中已有的 `.sql-studio` 保留在原位置。

### GitHub Release 与更新

「系统设置 → 关于软件」显示当前版本。Electron 额外提供“查看控制台”，通过无参数 `openConsole` 桥接打开当前工作台的独立开发者工具窗口，主进程校验当前窗口、主 frame 与页面来源；网页端隐藏该入口。Electron 可手动检查 [SQL Studio 的公开 GitHub Releases](https://github.com/xiaozhang95/SQL-Studio/releases)，发现更高的正式版本后可打开对应的下载页。Windows NSIS 安装版在该版本同时包含对应架构的安装包与 `latest.yml` 时，可在应用内下载整个安装包，点击“重启并安装”后先完成同一退出确认与连接清理流程，再退出本地 Go 服务并启动安装；取消退出不会安装。绿色版、调试版和其他平台通过 Release 页面下载安装；网页端仅显示构建时的版本号。

检查读取公开 `/releases/latest` 的 JSON 响应，允许 GitHub 跳转到具体发行版页面，设置 Accept 与产品 User-Agent，禁用响应缓存，版本查询超时 15 秒；与 electron-updater 的 GitHub 正式版检查方式一致，不依赖 `api.github.com` 的匿名 REST 配额。仅接受有效的正式语义版本。Windows 安装版再由 electron-updater 读取更新清单，核对目标版本、当前架构安装包名称、单文件记录与 SHA-512；清单缺失、不可读取或不匹配时仍显示发现的新版本并保留手动下载。下载前再次验证清单，下载本身继续使用 updater 的完整文件与校验流程。

主进程记录详细异常，更新 IPC 仅返回固定错误码，preload 解包为原有 Promise 接口。界面区分限流、HTTP 403 拒绝、无公开正式版、超时、网络、服务故障、响应格式与清单不匹配，不把所有失败归为无法访问 GitHub。共享检查/下载任务与退出后安装流程保持不变。

应用内下载通过 electron-updater 的 `download-progress` 事件更新设置页和左侧主题分隔线上方的圆形进度。关闭设置后侧栏继续显示进度，校验成功后切换为「重启并安装」图标，点击沿用同一个退出和安装流程。主进程保留递增 revision 的状态快照，`getState`/`onState` 桥接仅供同源工作台读取和订阅。下载失败后设置页保留最后进度与安全错误码，重试清零。应用内进度适用于支持自动下载的安装版。

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

桌面窗口保留系统窗口按钮，由前端绘制标题栏。共享的 DesktopTitleBar 提供 macOS 24px、Windows/Linux 32px 高拖动区域，和页面内容共用 Ant Design `colorBgContainer`（`--surface`），下沿有 1px 主题分隔线。亮色、暗色、跟随系统及功能页切换均使用同一主题。Windows/Linux 原生窗口按钮使用透明底，打开弹窗时透出同一遮罩，图标颜色通过受限 IPC 同步。macOS 红黄绿按钮位于 x=12/y=6，系统级菜单栏由操作系统管理。

工作台、AI 助手、监控和同步直接展示业务内容。Electron 在这些页面上方显示窗口标题栏；AI 助手恢复记录和聊天时均显示当前语言的「AI 助手」窗口标题。

工作区最上方标题随活动页联动，例如 `sql_studio_demo · 查询 2`，复用页签完整标题；切库、切页同步，空工作区显示 SQL Studio。Windows 将 Logo 与标题整体左对齐，左右留白沿用 workspace-inset（16px），Logo 左边缘与下方侧栏搜索框的外边缘对齐；macOS/Linux 继续居中，macOS 左侧保留红黄绿窗口按钮。渲染页面的 document.title 同时同步系统窗口标题，后台工作台不覆盖 AI 页状态；AI 助手、监控和同步页均显示当前语言的功能页名称。

图标唯一来源是 [studio.svg](../sql-studio-frontend/public/studio.svg)。开发时直接在内存渲染。`pnpm build` 通过 `scripts/icons.mjs` 生成 PNG 图标，electron-builder 据此生成平台图标。网页 favicon、开屏、窗口、macOS Dock 和安装包使用同一 Logo。

macOS 单独生成带透明安全区的 `build/icons/mac-icon.png`。生成脚本替换 SVG 根元素的视口尺寸，在 1024px 画布内居中放置 824px 图形，四周各留 100px。打包版由 macOS 使用应用自带 ICNS，不在运行时覆盖 Dock 图标；开发预览才用带留白的 PNG 替换 Electron 默认图标。开屏、网页和其他平台继续使用未缩小的图标。

## Electron 镜像

项目 `.npmrc` 配置 npm registry 与二进制下载镜像：

```ini
registry=https://registry.npmmirror.com/
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

`scripts/electron.mjs` 在启动 Electron 前显式设置 `ELECTRON_MIRROR`，确保 Electron 首次按需下载也走镜像；`electron-builder.cjs` 配置 `electronDownload.mirror` 与 `ELECTRON_BUILDER_BINARIES_MIRROR`，覆盖打包下载。可通过同名环境变量覆盖镜像。保留正常 TLS 与校验和验证。

## 进程与配置

关闭窗口、应用退出和更新安装共用退出握手。原生窗口先保留，前端回到工作区，从当前标签开始逐页激活和读取内容。非空查询使用 Ant Design 默认位置的确认框询问“是否保存对「标签名」的更改？”，按钮从左到右为“取消 / 不保存 / 保存”；空白查询直接关闭，未提交对象修改和运行请求按页提示。每次仅保存对应标签原文为独立文件，确认框完全关闭、保存完成后，严格提交本页关闭快照并删除标签、切到下一页。准备阶段暂停自动保存并锁定工作区交互，标签保持可见。

取消或保存失败停在当前标签，当前及未处理标签和连接保留，已关闭标签不恢复。全部标签处理完才挂起页面，停止监控、Agent 和 Redis 订阅及其他请求，再等待全部已保存连接的关闭回执，最后提交空工作区才通知主进程退出。下次正常启动不恢复已关闭标签、结果或连接；默认及自定义连接分组保留原展开或收起状态。没有导出为文件的 SQL 不再恢复，连接配置不删除。

保存失败、版本冲突或连接释放失败会显示原因并保留窗口，已成功关闭的连接不自动恢复。重复关闭共享一个任务，旧请求回执不能结束新请求；仅当前窗口、主 frame 和同源页面可参与握手。开屏可直接取消启动；工作台崩溃或未接收请求时提供原生“取消/强制退出”提示，强制退出可能丢失未保存内容并跳过连接清理。Web 的关闭与刷新行为保持原样。

桌面调试使用手动启动的 Vite 和 Go 服务，关闭 Electron 后，开发服务继续运行。打包版自动选择 `127.0.0.1` 空闲端口，启动随包 Go 服务，等待 `/api/health` 就绪后加载同源网页。关闭最后一个窗口即退出，打包版会清理自己创建的 Go 子进程。macOS/Linux 最多等待 6 秒，Windows 使用系统进程终止语义。

桌面页面使用 `/`、`/agent`、`/monitor`、`/sync` 历史路由，页面内切换不整页加载。同源导航与标题栏桥接沿用现有规则，直接访问或刷新时由随包 Go 服务提供同一网页入口。

桌面调试默认使用当前用户主目录下的 `.sql-studio-dev/`，与 `go run main.go` 的开发配置一致。绿色版和安装版使用 `.sql-studio/`。Windows 位于 `%USERPROFILE%` 下，macOS 和 Linux 位于 `~/` 下。`app.isPackaged` 决定桌面默认目录；构建脚本将随包 Go 程序的默认环境设为 production，启动子进程时同时明确 `SQLDESK_ENV=production`。开发与发行配置互相独立，不自动迁移已有文件。

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

窗口配置关闭 Node 集成并启用 contextIsolation、sandbox 和 webSecurity。传入 `--no-sandbox` 时关闭 Chromium 沙箱。preload 提供只读平台标识和标题栏高度、主题同步、纯文本复制和受限的更新方法。主进程校验调用窗口和来源，更新只访问配置的公开 GitHub 仓库；工作台拒绝外部导航、新窗口、webview 和页面权限请求。SQL 预览通过 `writeClipboardText(text)` 桥接调用原生 clipboard.writeText，仅允许当前工作台主 frame 的同源请求，退出中或复制失败时返回 false，不提供剪贴板读取能力。SQL 转储、编辑器导出及关闭前保存均通过原生保存对话框选路径，主进程分块写入同目录临时文件，写完后替换目标。取消、写入错误、页面重载及窗口退出清理未完成文件。API 仍是后端原有的本机单用户 HTTP 服务。

## 代码与检查

- `src/main.mjs`：窗口、单实例、应用生命周期与原生保存（`save-begin`/`save-commit`/`save-discard`）。
- `src/quit.mjs`：窗口退出握手、请求去重、取消及无响应时的原生确认。
- `src/backend.mjs`：本地服务启动、就绪等待与子进程清理。
- `src/policy.mjs`：导航边界、权限判定与后端环境隔离。
- `src/preload.cjs`：标题栏、控制台、纯文本复制、更新与原生保存桥接。
- `src/clipboard.mjs`：受限的原生文本写入，非法请求或系统失败静默返回 false。
- `src/sql-save.mjs`：原生保存会话、分块写盘、原子替换和取消清理。
- `src/updates.mjs`：GitHub 正式版本查询、NSIS 更新下载与安装。
- `src/startup/`：不依赖 Go 服务的本地全窗口启动动画及视图清理。
- `scripts/`：Electron 镜像启动入口、桌面资源构建。
- `scripts/windows/`：Windows GUI 启动入口及 NSIS 安装、升级和卸载逻辑。
- `electron-builder.cjs`：应用与安装包配置。
- `tests/`：导航、权限策略、配置隔离与健康检查契约测试。
- `tests/updates.test.mjs`：公开发行页检查、真实 HTTP 跳转、安全错误码与 preload 解包、绿色版回退、更新清单和下载/安装边界；使用替身与临时 HTTP 服务，不访问 GitHub 或启动 Electron。

```sh
node --test tests/*.test.mjs
```

这些 Node 测试使用替身或临时 HTTP 服务，不访问数据库；不能替代真实窗口、安装包或 SQL 回归。
