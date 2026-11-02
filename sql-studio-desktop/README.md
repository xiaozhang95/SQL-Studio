# SQL Studio Electron

Windows x64 桌面入口，复用现有 React 前端与内嵌 Gin 后端。无需用户另行启动服务、安装 Node/Go 或打开浏览器。

## 构建与启动

开发机器需要 Node >=22.12、pnpm、Go 和 PowerShell。在本目录执行：

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

`pnpm build` 调用仓库现有 `build.ps1` 构建最新前端和内嵌 Go 程序，复制为 `runtime/backend/sql-studio-backend.exe`。`pnpm start` 启动本目录 Electron 主进程，使用已生成的后端；修改前端或后端后重新 build。

```powershell
pnpm run pack
pnpm dist
pnpm test
```

- `pnpm run pack` 自动构建最新后端和前端，生成 `../release/electron/win-unpacked/SQL Studio.exe`，适合本机调试；须保留 run，避免调用 pnpm 的同名 tarball 命令。
- `dist` 自动构建，生成 Windows x64 NSIS 安装包和 portable 免安装程序，位于 `../release/electron/`。安装包按当前用户安装，允许选择目录，卸载保留用户配置；不自动发布或上传。
- `test` 使用 Node 测试隔离环境、随机端口和真实内嵌后端启动/保存/重启/退出；先 build。测试只使用 runtime 下新建目录，不连接数据库。
- 当前未配置代码签名证书、自动更新、macOS/Linux 分发。产物为未签名的本地构建。

## 镜像

项目级 `.npmrc` 设置 npm registry 为 `https://registry.npmmirror.com/`，Electron 镜像为 `https://npmmirror.com/mirrors/electron/`，electron-builder 工具二进制镜像为 `https://npmmirror.com/mirrors/electron-builder-binaries/`。

Electron 45 改为按需下载运行时；`scripts/desktop.cjs` 显式运行其安装器并传入 `ELECTRON_MIRROR`，打包器同时使用 package.json 中的 `electronDownload.mirror`。支持通过 `ELECTRON_MIRROR` 与 `ELECTRON_BUILDER_BINARIES_MIRROR` 覆盖下载源，保留 Electron 官方内置校验，不关闭 TLS 验证。依赖版本及锁文件固定，pnpm-workspace.yaml 明确允许或禁用依赖构建脚本。

依据：[Electron 镜像与按需安装](https://www.electronjs.org/docs/latest/tutorial/installation)、[electron-builder Windows](https://www.electron.build/v26/docs/win/)。

## 生命周期与配置

`src/main.cjs` 管理单实例、主窗口和退出；`backend.cjs` 管理其专属后端子进程；`preload.cjs` 只暴露异步退出保存握手。页面复用原 HTTP API，不注入数据库密码、文件系统或任意 IPC。

每次启动选择一个空闲的 127.0.0.1 随机端口，不占用原来的 8080，也不连接或停止既有浏览器版服务。显式覆盖后端状态目录并剔除继承的 SQLDESK_* 参数，避免环境变量意外创建连接、使用旧 dist 或访问原配置。

默认配置位于 Electron `app.getPath('userData')/state`；Windows 通常为 `%APPDATA%/SQL Studio/state`。连接、密钥、工作区、历史、主题及 AI 配置随用户保存，浏览器版原 `.sql-studio/state` 不自动迁移或删除。需要迁入时先退出两个程序，再整体备份/复制原 state 内容（含 master.key 与工作区分片）到桌面版 state，避免只复制连接文件。

可通过 `SQLSTUDIO_DESKTOP_DATA_DIR` 指定 Electron 用户目录根，用于隔离验证或自定义位置；其下 state 为后端配置，其他内容为 Electron 自身数据。不可让两个进程同时写同一配置目录。

正常退出先请求前端同步编辑缓冲并等待工作区、历史和主题保存完成，再结束自己的后端。读取/保存失败、查询或导出进行中、表格未保存时允许返回编辑或明确直接退出。强制终止、系统关机与崩溃不保证最后的未保存编辑持久化；查询取消/进程退出不表示数据库写入回滚。

窗口启用 sandbox/contextIsolation，禁用 Node 集成、webview、新窗口及跨源导航；主进程验证退出回包来源和请求 ID。浏览器版无 bridge 时保持原行为。

若在受限的代理工作区运行时遇到窗口出现前的 `0x80000003`，可将安装包或免安装程序复制到普通用户目录再运行。本轮官方 Electron 与 unpacked 程序在受限工作区均出现该退出码，同一产物复制到普通临时目录后窗口与退出恢复正常；未修改 ACL、系统设置或关闭 Electron 沙箱。后端输出在主进程内有界收集，不转写可能已断开的启动终端管道。

## 目录

- `src/`：主进程、后端生命周期及隔离 preload；[说明](src/README.md)。
- `scripts/desktop.cjs`：仅桌面构建/打包/运行命令，不替换 Go 原生开发入口。
- `tests/backend.test.cjs`：生命周期回归。
- `runtime/`、`node_modules/`、`release/electron/` 为本地生成内容，不提交凭据或构建产物。
