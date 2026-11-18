# 桌面契约

`onBeforeQuit(handler: () => Promise<boolean>): () => void` 注册异步退出准备并返回注销函数。preload 接收主进程生成的请求 ID 后，先通过 invoke 确认该请求仍然有效，才运行 handler；过期请求不会启动清理。等待 handler 完成，再仅对该 ID 回传允许/取消；异常视为取消。handler 必须完成 SQL 提示、工作区保存和连接释放后才返回 true。主进程校验当前窗口、主 frame 及同源来源，等待回执后才停止后端；重复关闭共享任务，已收到请求后的用户确认不受接收超时影响。Web 不提供此桥接，不增加 beforeunload 或 pagehide 清理操作。

`DesktopBridge` 为可选的 `window.sqlStudioDesktop`，由 Electron preload 提供。只读 `platform` 取自 Electron 的 process.platform，支持 win32/darwin/linux，供界面明确区分操作系统；`titleBarHeight` 为只读标题栏高度，`setTitleBarTheme(DesktopTitleBarTheme): void` 同步标题栏背景、按钮前景和亮暗模式。普通浏览器不提供该对象。

`DesktopTitleBarTheme` 包含 background/foreground（三位或六位十六进制颜色）和 mode（light/dark）。主进程继续校验消息来源与颜色，不暴露通用 IPC 或数据库权限；保持系统主题源不变，避免阻断「跟随系统」。

`openConsole(): Promise<void>` 打开当前工作台的独立开发者工具窗口，无页面传入参数。主进程沿用窗口、主 frame 和同源校验，退出中拒绝；普通浏览器不提供该入口。关于软件页面调用此方法，不写入设置草稿。

`saveFile.begin(filename, filterName)` 打开原生保存对话框，成功返回会话 ID 与实际路径，取消返回 `{ canceled: true }`。调用方依次等待 `append(id, bytes)` 写入 UTF-8 分块，再调用 `commit(id)` 发布完整文件。取消或失败调用 `discard(id)` 清理。路径由原生对话框决定。

`DesktopUpdates` 提供 `check()`、`download()`、`openRelease()` 和 `install()`。`check()` 返回 `DesktopUpdateStatus`，包括 `upToDate`、`available`（含版本及是否能在应用内下载）和 `downloaded`（含版本）；`download()` 成功后返回 `downloaded`。`openRelease()` 打开主进程选定的公开 GitHub 页面，`install()` 请求退出并安装已下载版本。主进程校验调用窗口和来源，失败时 Promise 拒绝。更新入口不接受页面传入的 URL、安装路径或命令。
