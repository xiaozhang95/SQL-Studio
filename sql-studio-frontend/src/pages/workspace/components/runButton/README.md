# 运行按钮

`RunButton({themeMode,disabled,onClick})` 是 SQL 窗口和 Redis 编辑器共用的唯一 primary 运行操作：播放图标、文案「运行」和平台快捷键（`Ctrl↵` / `⌘↵`）由本组件统一渲染，避免两处复制。

调用方只传入当前主题、禁用状态和执行回调；按钮尺寸、图标和快捷键提示沿用项目主题与 Ant Design 默认按钮。执行中的取消操作仍由各自工具栏以 text danger 提供。
