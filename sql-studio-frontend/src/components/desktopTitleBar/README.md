# DesktopTitleBar

Electron 标题栏，由 App 放在全局 Rail 与页面内容之前，横跨整个窗口。showTitle?: boolean 默认 true，控制最上方的应用标题；AI 助手显示当前语言的「AI 助手」。浏览器中返回 null；桌面中高度取自 preload 的只读 titleBarHeight：macOS 24px、Windows/Linux 32px。

title?: string 默认 SQL Studio，由 App 按当前页面计算：工作区使用活动页签的完整标题，AI 助手、监控、同步使用功能页名称，并通过 document.title 同步系统窗口标题。active?: boolean 默认 true；工作台在后台页保持挂载，但 App 直接按当前 section 计算标题，避免迟到更新覆盖。

背景与页面内容共用 `--surface`，文字沿用 `--text`。标题栏下沿使用贯穿窗口的 1px `--layout-divider` 分隔线。主题 token 变化后调用窄接口 setTitleBarTheme，同步窗口底色与 Windows/Linux 原生窗口按钮图标颜色；按钮使用透明底，弹窗遮罩打开时透出同一渲染层。系统主题源支持继续跟随系统。拖动区域由 app.scss 的 `.desktop-titlebar` 提供。

不读取数据库，不持久化新状态；桥接契约见 [desktop](../../typings/desktop/README.md)。

可见标题左侧展示 16px 应用 Logo。仅 preload 的 platform 为 win32 时，Logo 和标题整体左对齐；左右留白共用 workspace-inset（16px），使 Logo 左边缘与下方侧栏搜索框的外边缘对齐。macOS 和 Linux 继续整体居中，macOS 左侧保留系统红黄绿窗口按钮的位置。Logo 不参与拖拽，长标题仍省略。
