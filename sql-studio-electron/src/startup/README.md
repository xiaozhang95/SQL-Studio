# 启动动画

`createStartupScreen(window, { icon, dark, followSystem = false })` 在现有 BrowserWindow 内创建铺满内容区的本地 WebContentsView。它在 Go 服务启动前显示，不依赖 HTTP、端口或外网；缩放窗口时同步尺寸。Logo 从应用图标转为 data URL。

`readStartupAppearance(stateDirectory, systemDark)` 只读现有 appearance.json 中 schemaVersion=1 的 data.theme，固定 light/dark 优先于系统。system 或首次启动使用系统亮暗状态。损坏、未知版本或超过 64 KiB 的外观文件仅让开屏回退到系统，不覆盖文件。开屏和工作台使用同一个状态目录，默认位于用户主目录下的 `.sql-studio/state/`。followSystem=true 时开屏继续响应系统主题变化，移除视图时注销监听。

返回 setStage(service/workspace/ready/error)、complete(): Promise<void> 和幂等 dispose()。开屏期间并行启动服务和加载工作台；工作台就绪后继续停留 2000ms。工作台文档及标题栏主题消息均就绪、再停留两秒后，complete 发送 ready，等待 240ms 淡出并移除视图、关闭 webContents。窗口关闭会中断剩余等待并同步清理，不留额外渲染进程。

本地页只接收固定阶段消息，无网络、Node、通用 IPC 或写入能力；CSP 限制脚本、样式为本地来源。通过三个依次闪动的圆点表示等待，不展示进度条；圆点继承当前亮暗主题的文字色。减少动态效果偏好下改为静态圆点。操作系统全屏状态不被启动页改变，动画填满当前应用窗口。

可见内容仅包含数据库 Logo、SQL Studio 名称和圆点，无宣传语、加载或就绪文案。状态仍驱动 aria-busy、淡出和失败时停止动画，错误详情沿用主进程对话框。

Logo 与名称居中横排，名称字号最大为 92px，Logo 按该响应式尺寸的 88% 显示，加载点直径为 9px，三个圆点在整组下方居中。保留轻微悬浮、光晕和依次闪动效果。
