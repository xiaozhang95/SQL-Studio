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

在本项目目录执行：

```sh
# 构建前端及当前平台的 Go 服务到 build/runtime
pnpm prepare:runtime
# 不依赖 Vite 或手动启动的 Go 服务，预览完整桌面启动流程
pnpm start

# 生成可运行的应用目录
pnpm build
# 生成当前平台安装包：macOS dmg / Windows NSIS / Linux AppImage
pnpm dist
```

`build` / `dist` 都会重新构建前端与 Go。构建前需安装前端依赖，Go 依赖需可下载。产物位于本项目 `release/`；`build/runtime/` 包含后端可执行文件和 `web/` 静态页面，通过 `extraResources` 放入应用 resources，后端可执行文件位于 ASAR 外。现有根目录 `build.ps1` 的网页独立可执行文件打包流程继续使用。

当前命令按宿主平台和架构成套构建，不支持附加 electron-builder 跨平台/跨架构参数；请在目标平台构建，避免 Go 与 Electron 架构不匹配。macOS 产物未签名、未公证，Windows 产物未签名；正式分发需另行配置签名。

## 标题栏和应用图标

应用先显示[铺满窗口的启动动画](src/startup/README.md)，仅展示数据库 Logo、SQL Studio 名称和三个依次闪动的圆点，不显示宣传语及加载阶段文案。开屏至少显示两秒，服务和工作台并行初始化；服务健康检查通过后在其下方加载工作台，等待文档及首个标题栏主题消息就绪，再淡出切换。开屏优先读取已保存的亮色/暗色主题，跟随系统时也会响应系统变化。支持减少动态效果偏好。动画不改变操作系统的全屏状态。

启动失败沿用错误对话框并清理进程；启动过程中关闭窗口会取消健康检查并停止本次创建的服务，不继续在后台等待端口。

桌面窗口采用隐藏原生标题背景、保留系统窗口按钮的方式。前端共享的 DesktopTitleBar 提供 32px 高拖动区域，和业务 PageHeader 都使用 Ant Design `colorBgContainer`（`--surface`）；亮色、暗色、跟随系统及工作区/AI 助手切换均沿用同一主题。Windows/Linux 窗口按钮背景通过受限 IPC 同步，macOS 保留原生红黄绿按钮。系统级菜单栏仍由操作系统管理。

图标唯一来源是 `../sql-studio-frontend/public/studio.svg`：原创蓝底数据库圆柱与查询光标组合。启动和构建时，`scripts/icons.mjs` 使用 resvg 生成 1024px PNG 到 `build/icons/icon.png`；electron-builder 再生成对应平台的应用图标。网页 favicon、开屏、窗口、macOS Dock 和安装包使用同一 Logo，无需另外维护图标副本。

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

桌面版显式设置后端的网页、连接、状态目录，不继承终端里的 `SQLDESK_*` 初始数据库参数。配置保存到 Electron appData 下的 `sql-studio-electron/state`：

- macOS：`~/Library/Application Support/sql-studio-electron/state`
- Windows：`%APPDATA%/sql-studio-electron/state`
- Linux：`${XDG_CONFIG_HOME:-~/.config}/sql-studio-electron/state`

该目录包含连接、密钥、工作区及 AI 配置，与网页版的启动目录配置独立。需要沿用网页版数据时先退出两端服务，再完整复制原 state 目录（含 `master.key` 和工作区分片）；不会自动搬迁或删除旧数据。桌面应用使用单实例锁。

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
