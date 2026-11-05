# DesktopTitleBar

无 props 的 Electron 标题栏，由 PageHeader 放在业务顶栏之前。浏览器中返回 null；桌面中高度取自 preload 的只读 titleBarHeight，占据独立 flex 行，为系统窗口按钮预留空间，避免遮挡业务按钮。

背景与 PageHeader 共用 `--surface`，文字沿用 `--text`。主题 token 变化后调用窄接口 setTitleBarTheme，同步 Windows/Linux 原生窗口按钮的背景与前景；保持系统主题源不变，支持继续跟随系统。拖动区域仅限定在 app.scss 的 `.desktop-titlebar`，不影响业务控件点击或内容区滚动。

不读取数据库，不持久化新状态；桥接契约见 [desktop](../../typings/desktop/README.md)。
