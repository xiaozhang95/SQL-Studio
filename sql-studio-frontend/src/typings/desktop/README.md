# 桌面契约

`DesktopBridge` 为可选的 `window.sqlStudioDesktop`，由 Electron preload 提供。`titleBarHeight` 为只读标题栏高度，`setTitleBarTheme(DesktopTitleBarTheme): void` 同步标题栏背景、按钮前景和亮暗模式。普通浏览器不提供该对象。

`DesktopTitleBarTheme` 包含 background/foreground（三位或六位十六进制颜色）和 mode（light/dark）。主进程继续校验消息来源与颜色，不暴露通用 IPC 或数据库权限；保持系统主题源不变，避免阻断「跟随系统」。

`saveFile` 供桌面导出/保存 SQL，分三阶段：`begin(filename)` 弹原生保存对话框由用户选定路径，返回 `{ canceled, id?, filePath? }`（取消时调用方抛 AbortError 保留页面）；`commit(id, data)` 将完整文本写入 begin 选定的路径；`discard(id)` 放弃会话。渲染进程不传路径，写入路径始终由用户在原生对话框决定；不依赖渲染进程 File System Access 权限。

`DesktopUpdates` 提供 `check()`、`download()`、`openRelease()` 和 `install()`。`check()` 返回 `DesktopUpdateStatus`，包括 `upToDate`、`available`（含版本及是否能在应用内下载）和 `downloaded`（含版本）；`download()` 成功后返回 `downloaded`。`openRelease()` 打开主进程选定的公开 GitHub 页面，`install()` 请求退出并安装已下载版本。主进程校验调用窗口和来源，失败时 Promise 拒绝。更新入口不接受页面传入的 URL、安装路径或命令。
