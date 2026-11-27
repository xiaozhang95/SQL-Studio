# 启动动画

`createStartupScreen(window, { icon, dark, followSystem = false, language = 'zh-CN' })` 在现有 BrowserWindow 内创建铺满内容区的本地 WebContentsView，缩放窗口时同步尺寸。`icon` 是用于生成 Logo data URL 的 Electron NativeImage。`language` 设置开屏文档语言和加载状态的无障碍名称。调试版检查开发服务后显示，打包版在随包 Go 服务启动前显示。

`readStartupAppearance(stateDirectory, systemDark)` 读取 appearance.json，返回 preference、dark 和 language。只有 schemaVersion=1 且主题、字号、语言均有效才应用保存值。system 模式跟随系统亮暗，配置缺失或不可用时语言回退到简体中文。开屏和工作台使用同一个状态目录，开发默认位于用户主目录下的 `.sql-studio-dev/state/`，打包发行使用 `.sql-studio/state/`。followSystem=true 时开屏继续响应系统主题变化，移除视图时注销监听。

返回 setStage(service/workspace/ready/error)、complete(): Promise<void> 和幂等 dispose()。工作台文档及标题栏主题消息均就绪后，complete 停留 2000ms，再发送 ready 并等待 240ms 淡出，随后移除视图、关闭 webContents。窗口关闭会中断剩余等待并同步清理。

本地页只接收固定阶段消息。脚本限本地来源，`index.html` 中的 `<style>` 通过 CSP 的 SHA-256 哈希授权；修改样式时同步更新哈希。启动页与初始窗口背景对齐工作台的 Ant Design 容器底色（亮色 `#f2f2f2`，暗色 `#141414`）。光晕使用 Logo 放大镜的蓝色 `#2569DF`，文字使用系统界面字体。三个圆点依次闪动，减少动态效果偏好下静态显示。动画填满当前应用窗口。

可见内容仅包含数据库 Logo、SQL Studio 名称和圆点，无宣传语、加载或就绪文案。状态仍驱动 aria-busy、淡出和失败时停止动画，错误详情沿用主进程对话框。

Logo 与名称居中横排，Logo 尺寸为 48–104px，名称字号为 Logo 尺寸的 72%。加载点直径为 9px，在整组下方居中。
