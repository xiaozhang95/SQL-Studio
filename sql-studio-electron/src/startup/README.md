# 启动动画

`createStartupScreen(window, { icon, dark, followSystem = false })` 在现有 BrowserWindow 内创建铺满内容区的本地 WebContentsView，缩放窗口时同步尺寸。`icon` 是用于生成 Logo data URL 的 Electron NativeImage。调试版检查开发服务后显示，打包版在随包 Go 服务启动前显示。

`readStartupAppearance(stateDirectory, systemDark)` 读取 appearance.json，只有 schemaVersion=1 且主题、字号、语言均有效才应用主题。system、缺失或不可用时跟随系统亮暗。开屏和工作台使用同一个状态目录，默认位于用户主目录下的 `.sql-studio/state/`。followSystem=true 时开屏继续响应系统主题变化，移除视图时注销监听。

返回 setStage(service/workspace/ready/error)、complete(): Promise<void> 和幂等 dispose()。工作台文档及标题栏主题消息均就绪后，complete 停留 2000ms，再发送 ready 并等待 240ms 淡出，随后移除视图、关闭 webContents。窗口关闭会中断剩余等待并同步清理。

本地页只接收固定阶段消息，无网络、Node、通用 IPC 或写入能力；CSP 限制脚本、样式为本地来源。通过三个依次闪动的圆点表示等待，不展示进度条；圆点继承当前亮暗主题的文字色。减少动态效果偏好下改为静态圆点。操作系统全屏状态不被启动页改变，动画填满当前应用窗口。

可见内容仅包含数据库 Logo、SQL Studio 名称和圆点，无宣传语、加载或就绪文案。状态仍驱动 aria-busy、淡出和失败时停止动画，错误详情沿用主进程对话框。

Logo 与名称居中横排，名称字号最大为 92px，Logo 按该响应式尺寸的 88% 显示，加载点直径为 9px，三个圆点在整组下方居中。保留轻微悬浮、光晕和依次闪动效果。
