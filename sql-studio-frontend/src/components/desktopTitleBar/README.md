# DesktopTitleBar

Electron 标题栏，由 PageHeader 放在业务顶栏之前。showTitle?: boolean 默认 true，控制最上方的 SQL Studio 应用名；AI 助手传 false，保留业务 header 内的会话标题。浏览器中返回 null；桌面中高度取自 preload 的只读 titleBarHeight：macOS 24px、Windows/Linux 32px。业务顶栏的高度与内边距由 PageHeader 的主题 token 决定。

title?: string 默认 SQL Studio，显示当前工作区页签的完整标题，并通过 document.title 同步系统窗口标题。active?: boolean 默认 true，仅活动页面可同步；AI 页打开时后台工作台仍挂载，传 false 防止其迟到更新覆盖当前窗口标题。AI 页继续隐藏可见标题，系统窗口元数据恢复为 SQL Studio。长标题居中省略，左右预留窗口按钮空间，悬停显示全文。

背景与 PageHeader 共用 `--surface`，文字沿用 `--text`。主题 token 变化后调用窄接口 setTitleBarTheme，同步 Windows/Linux 原生窗口按钮的背景与前景；保持系统主题源不变，支持继续跟随系统。拖动区域仅限定在 app.scss 的 `.desktop-titlebar`，不影响业务控件点击或内容区滚动。

不读取数据库，不持久化新状态；桥接契约见 [desktop](../../typings/desktop/README.md)。

可见标题左侧展示 16px 应用 Logo，与标题作为整体居中；Logo 不参与拖拽，长标题仍省略。
