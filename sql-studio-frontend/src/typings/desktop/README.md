# Electron 退出契约

`DesktopBridge.onBeforeClose(callback)` 注册退出前异步保存回调并返回注销函数。由受隔离的 Electron preload 提供；只允许退出握手，不提供文件、进程或任意 IPC 访问。普通浏览器没有 `window.sqlStudioDesktop`，保持原行为。回调成功后才能退出，失败回传简短错误，由主进程提供返回编辑或直接退出选项。
