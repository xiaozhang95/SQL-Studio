# 桌面更新状态

`useDesktopUpdates()` 返回 `version`、`desktop`、`result`、`pending`、`error` 和 `run(action)`。`version` 默认是 Vite 构建版本，Electron 打开此页时尝试读取运行时版本。`desktop` 根据 Electron preload 桥接是否存在判断。`result` 记录检查或下载结果，`pending` 为正在执行的操作名，错误使用可翻译的文案键。

`run` 支持 `check`、`download`、`openRelease` 和 `install`，同一页面一次执行一个操作。离开页面销毁展示状态，主进程正在运行的检查或下载继续；重新打开后可再次检查。浏览器版本只展示版本号，更新操作依赖 [桌面契约](../../../../typings/desktop/README.md)。
