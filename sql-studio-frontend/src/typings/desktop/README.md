# 桌面契约

`DesktopBridge` 为可选的 `window.sqlStudioDesktop`：Electron preload 提供只读 `titleBarHeight` 和 `setTitleBarTheme(DesktopTitleBarTheme): void`，后者仅同步标题栏背景、按钮前景和亮暗模式。普通浏览器不提供该对象。

`DesktopTitleBarTheme` 包含 background/foreground（三位或六位十六进制颜色）和 mode（light/dark）。主进程继续校验消息来源与颜色，不暴露通用 IPC、文件或数据库权限；保持系统主题源不变，避免阻断「跟随系统」。
