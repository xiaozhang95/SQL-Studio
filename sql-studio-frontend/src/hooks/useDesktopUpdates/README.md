# 桌面更新状态

`useDesktopUpdates(): DesktopUpdatesModel` 提供桌面更新的状态和操作。`desktop` 表示是否有 Electron 桥接，`result` 记录检查或下载结果，`pending` 为当前操作。`progress` 包含百分比、已传输字节、总字节和每秒字节数，`downloadStatus` 提供准备、下载和校验文案，`downloadFailed` 标记下载失败，`error` 按桥接错误码提供可翻译提示。

`run` 支持 `check`、`download`、`openRelease` 和 `install`，同时只执行一个操作。[AppRail](../../components/appRail/README.md) 持有一个实例，侧栏更新入口与系统设置共用，关闭设置或切换分类时继续接收进度。Hook 先订阅主进程状态，再读取当前快照，只接受更大的 revision，卸载时取消订阅。校验成功前保持下载中，失败保留最后进度，重试从零开始。更新操作依赖 [桌面契约](../../typings/desktop/README.md)。
