# SQL Studio Electron

独立的桌面壳项目，与 `sql-studio-frontend`、`sql-studio-backend` 同级，单独管理依赖和锁文件。复用现有 React 工作台与 Go HTTP API，不复制前后端源码、不改变网页运行方式。

## 安装与开发

需要 Node.js 22.12+、pnpm、Go。首次分别安装前端与本项目依赖：

```sh
cd sql-studio-frontend
pnpm install --frozen-lockfile
cd ../sql-studio-electron
pnpm install --frozen-lockfile
```

开发时在三个终端分别运行（均从仓库根目录进入）：

```sh
cd sql-studio-backend
go run main.go
```

```sh
cd sql-studio-frontend
pnpm dev
```

```sh
cd sql-studio-electron
pnpm dev
```

开发窗口加载 `http://127.0.0.1:15173`，Vite 代理 `/api` 到 Go 的 `127.0.0.1:18080`。此模式复用手动启动的后端及其配置，关闭窗口不会停止开发服务。保留默认菜单，可通过 View 菜单打开开发工具。

## 桌面预览与打包

只有三条命令（`pnpm dev` 仅用于上面的开发模式，`pnpm test` / `pnpm check` 为自检）：

```sh
# 1. 打包前后端：前端 dist + 当前平台的 Go 服务 → build/runtime
pnpm bundle

# 2. 启动桌面应用（用 build/runtime 里的产物，不依赖 Vite 和手动起的 Go 服务）
pnpm start

# 3. 出成品：先跑 bundle，再打包成 release/
#    Windows 为 win-unpacked + NSIS 安装包，macOS 为 dmg，Linux 为 AppImage
pnpm build
```

`build` 已包含 `bundle`，所以打包只需要一条 `pnpm build`；`bundle` 单独保留是为了"只更新前后端产物、再用 `pnpm start` 预览"这条快路径。产物位于本项目 `release/`；`build/runtime/` 包含后端可执行文件和 `web/` 静态页面，通过 `extraResources` 放入应用 resources，后端可执行文件位于 ASAR 外。现有根目录 `build.ps1` 的网页独立可执行文件打包流程继续使用。

当前命令按宿主平台和架构成套构建，不支持附加 electron-builder 跨平台/跨架构参数；请在目标平台构建，避免 Go 与 Electron 架构不匹配。macOS 产物未签名、未公证，Windows 产物未签名；正式分发需另行配置签名。

Windows 安装包按当前用户安装到 `%LOCALAPPDATA%\Programs\SQL Studio`，不申请管理员权限，安装过程中可以改目录（`electron-builder.cjs` 的 `nsis` 段：`oneClick: false`、`perMachine: false`、`allowElevation: false`）。默认的一键安装器在普通账户或装了杀软的机器上会静默失败，所以显式关掉了提权和强制路径。

安装器默认创建的桌面/开始菜单快捷方式**不带任何参数**，在本机双击会直接崩（见下节），因此 `build/installer.nsh` 用 `customInstall` 宏按同样路径重建了一遍，把 `--no-sandbox` 写进快捷方式；`win.extraFiles` 还会把 `scripts/launch.cmd` 放进安装目录，作为 exe 级兜底。安装包装完启动的仍是未签名程序，杀软可能拦截写入，这类情况需要把安装目录加进白名单。

安装器会在 `HKCU\Software\<APP_GUID>` 的 `InstallLocation` 里记住上次选择的目录，下次安装默认就填它。想恢复默认路径，删掉这个值和 `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\<APP_GUID>` 即可。

`pnpm build` 若报 `EBUSY: resource busy or locked, unlink '…app.asar'`，不是配置问题：`release/` 里上一次的产物还被别的进程开着，这些 asar 既删不掉也改不了名（所在目录同样改名失败），electron-builder 清场时就卡住。

已用句柄枚举确认根因：**同时打开本项目的工作区里的 Electron 应用**（VS Code、WorkBuddy 等）会把目录树里出现的 `.asar` 当压缩包打开，并把文件句柄缓存到进程退出为止——`release/win-unpacked/resources/app.asar`、`release/win-unpacked.tmp/resources/default_app.asar` 就是这样被它们的主进程占住的，和杀毒软件、终端无关。

处理顺序：

1. 退出同时打开本项目的编辑器（VS Code / WorkBuddy），或重启后再打包——句柄随进程退出释放；
2. 急着出包可以先换个输出目录：`SQL_STUDIO_OUT=release-ok pnpm build`（`electron-builder.cjs` 里输出目录读这个环境变量，缺省仍是 `release`；`release*/` 已被忽略）；
3. 让编辑器别去碰构建产物，能显著降低复发概率：在 VS Code 的 `files.watcherExclude` / `search.exclude` 里加上 `**/release*/**`，或在资源管理器里折叠 `release` 目录。

打包版双击无反应，按下面两种原因分别排查。启动过程会往 `<数据根>/state/electron.log` 写一行诊断日志（`starting packaged=… data=… userData=…`），先看这个文件最快。

1. **数据目录建不出来 → 单实例锁失败 → 静默退出（退出码 0，无任何提示）**。`app.setPath('userData')` 指向的目录不会自动创建，缺了它 Chromium 建不了锁文件（`Lock file can not be created … 0x3`），`requestSingleInstanceLock()` 返回 false 就直接 `app.quit()`。现在启动时先 `mkdirSync` 数据根，建不出来会弹错误框说明目录不可写，不再静默退出。
2. **Chromium 沙箱初始化失败**：进程在 `main.mjs` 执行之前就以 `STATUS_BREAKPOINT`（`0x80000003`，Node 读到 `2147483651`）退出，日志和 `--enable-logging` 都不会有任何输出。这一条在本机是确定性可复现的，与 WorkBuddy 沙箱无关：用计划任务（独立进程树、普通用户令牌）启动不带参数的 exe，`LastTaskResult` 就是 `2147483651`，加上 `--no-sandbox` 才起得来。沙箱开关只能由命令行决定（主进程里 `app.commandLine.appendSwitch` 来不及生效），所以**快捷方式和启动脚本必须带该参数**——安装器由 `build/installer.nsh` 处理，绿色版用同目录的 `启动 SQL Studio.cmd`。要让不带参数的 exe 也能启动，得从系统侧解决（火绒/Windows 漏洞防护对 `SQL Studio.exe` 的注入与沙箱拦截），不是应用能绕过的。

## 标题栏和应用图标

应用先显示[铺满窗口的启动动画](src/startup/README.md)，仅展示数据库 Logo、SQL Studio 名称和三个依次闪动的圆点，不显示宣传语及加载阶段文案。服务和工作台并行初始化；服务健康检查通过后在其下方加载工作台，等待文档及首个标题栏主题消息就绪，继续停留两秒再淡出切换。开屏优先读取已保存的亮色/暗色主题，跟随系统时也会响应系统变化。支持减少动态效果偏好。动画不改变操作系统的全屏状态。

启动失败沿用错误对话框并清理进程；启动过程中关闭窗口会取消健康检查并停止本次创建的服务，不继续在后台等待端口。

桌面窗口采用隐藏原生标题背景、保留系统窗口按钮的方式。前端共享的 DesktopTitleBar 提供 macOS 24px、Windows/Linux 32px 高拖动区域，和业务 PageHeader 都使用 Ant Design `colorBgContainer`（`--surface`）；亮色、暗色、跟随系统及工作区/AI 助手切换均沿用同一主题。Windows/Linux 窗口按钮背景通过受限 IPC 同步，macOS 红黄绿按钮位于 x=12/y=6，与缩短的标题栏一起布局。系统级菜单栏仍由操作系统管理。

浏览器与 Electron 业务 header 均保留 56px 高度及原上下内边距；调整的是 macOS 系统按钮区域到业务 header 之间的距离。AI 助手隐藏最上方的 SQL Studio 应用名，业务 header 中的会话标题继续保留。

工作区最上方标题随活动页联动，例如 `sql_studio_demo · 查询 2`，复用页签完整标题；切库、切页同步，空工作区显示 SQL Studio。渲染页面的 document.title 同时同步系统窗口标题，后台工作台不覆盖 AI 页状态；AI 页仍隐藏最上方标题。

图标唯一来源是 `../sql-studio-frontend/public/studio.svg`：原创蓝底数据库圆柱与查询光标组合。启动和构建时，`scripts/icons.mjs` 使用 resvg 生成 1024px PNG 到 `build/icons/icon.png`；electron-builder 再生成对应平台的应用图标。网页 favicon、开屏、窗口、macOS Dock 和安装包使用同一 Logo，无需另外维护图标副本。

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

桌面预览和打包版自动选择 `127.0.0.1` 空闲端口、启动随包 Go 服务，等待 `/api/health` 就绪后加载同源网页，因此 `/api`、流式请求、导出沿用浏览器实现。关闭最后一个窗口即退出；退出时只清理本次创建的 Go 子进程，macOS/Linux 先给予最多 6 秒退出时间，Windows 使用系统进程终止语义，不承诺在途请求完成。

桌面版显式设置后端的网页、连接、状态目录，不继承终端里的 `SQLDESK_*` 初始数据库参数。数据统一收在 `.sql-studio` 一个目录里，和 Go 服务用的是同一份（`go run main.go` 就在 `sql-studio-backend` 下生成它）：

- `sql-studio-backend/.sql-studio/state`：连接、密钥、工作区及 AI 配置
- `sql-studio-backend/.sql-studio/electron`：Electron/Chromium 自身数据（窗口状态、缓存等）

打包版优先把数据放在 exe 同级的 `.sql-studio`（绿色版拷到哪，数据就跟到哪），同样是 `state/` 和 `electron/`。安装到 `Program Files` 这类只读位置、建不出该目录时，自动退回系统 appData 下的 `sql-studio-electron`：

- macOS：`~/Library/Application Support/sql-studio-electron/`
- Windows：`%APPDATA%/sql-studio-electron/`
- Linux：`${XDG_CONFIG_HOME:-~/.config}/sql-studio-electron/`

`state/` 包含连接、密钥、工作区及 AI 配置，与网页版的启动目录配置独立。桌面预览与 `go run main.go` 共用同一份，两端不要同时启动；需要沿用网页版数据时先退出两端服务，再完整复制原 state 目录（含 `master.key` 和工作区分片）；不会自动搬迁或删除旧数据。桌面应用使用单实例锁。

需要换一个数据根（便携运行、受限终端）时用 `SQL_STUDIO_DATA_DIR` 指定，取绝对路径或相对启动目录的路径，`state/` 与 `electron/` 都会建在它下面：

```sh
SQL_STUDIO_DATA_DIR=./.data pnpm start
```

```powershell
$env:SQL_STUDIO_DATA_DIR="D:\sql-studio-data"; pnpm start
```

带白名单/沙箱管控的终端（例如 IDE 内置终端）会阻止 Chromium 初始化自身沙箱，Electron 主进程在执行 `main.mjs` 之前就以 `STATUS_BREAKPOINT`（`0x80000003`，shell 里显示 `-2147483645`，Node 上报 `2147483651`）静默退出，终端里没有任何报错。`scripts/electron.mjs` 命中这两个退出码时自动降级重试一次：该次运行关闭 Electron 沙箱（`--no-sandbox`），数据目录不变（本来就在项目内），同时打印提示。降级只作用于这次调试运行，不进入打包产物；普通终端不会走到这条路径。

渲染进程关闭 Node 集成，开启 contextIsolation、sandbox 和 webSecurity；preload 仅提供只读标题栏高度和主题同步接口，不暴露通用 IPC。主进程校验调用来源和颜色；拒绝外部导航、新窗口、webview 和页面权限请求。API 仍是后端原有的本机单用户 HTTP 服务。

## 代码与检查

- `src/main.mjs`：窗口、单实例与应用生命周期。
- `src/backend.mjs`：本地服务启动、就绪等待与子进程清理。
- `src/policy.mjs`：导航边界与后端环境隔离。
- `src/preload.cjs`：最小标题栏主题桥接。
- `src/startup/`：不依赖 Go 服务的本地全窗口启动动画及视图清理。
- `scripts/`：Electron 镜像启动入口、桌面资源构建。
- `electron-builder.cjs`：应用与安装包配置。
- `tests/`：导航、配置隔离与健康检查契约测试。

```sh
pnpm check
```

这些 Node 测试使用临时 HTTP 服务，不访问数据库；不能替代真实窗口、安装包或 SQL 回归。
