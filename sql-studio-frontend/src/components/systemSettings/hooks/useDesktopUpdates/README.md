# 桌面更新状态

`useDesktopUpdates()` 返回 `desktop`、`result`、`pending`、`progress`、`downloadFailed`、`error` 和 `run(action)`。`desktop` 根据 Electron preload 桥接是否存在判断。`result` 记录检查或下载结果，`pending` 为正在执行的操作名；`progress` 包含下载百分比、已传输字节、总字节和每秒字节数，`downloadFailed` 标识下载失败。依据 DesktopUpdateErrorCode 区分限流、403 拒绝、无公开正式版、超时、网络连接、服务器故障、响应格式和安装清单不匹配，使用可翻译文案；未知错误按操作给出中性提示，不统一归因于无法访问 GitHub。

`run` 支持 `check`、`download`、`openRelease` 和 `install`，同一时间一次执行一个操作。先订阅主进程状态，再读取当前快照，按递增 revision 接收状态，迟到快照不覆盖新进度。离开页面移除订阅，主进程检查或下载继续；重新打开后恢复当前进度、失败原因或已下载状态，无需重新检查。校验成功前保持下载中，失败保留最后进度供重试。浏览器版本只展示版本号，更新操作依赖 [桌面契约](../../../../typings/desktop/README.md)。
