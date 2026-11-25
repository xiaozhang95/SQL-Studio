# 主题配置

`createThemeConfig(themeMode, fontSizeMode = 'standard')` 返回 App 使用的 Ant Design `ThemeConfig`。`themeMode` 选择亮色或暗色算法，`fontSizeMode` 通过主题和设置预览共用的 `uiFontSizes` 选择 12、14 或 16px。控件高度为 30px。函数无状态、请求和持久化。

主色种子取自 [Logo 放大镜描边](../../../public/studio.svg) 的蓝色 `#2569DF`。Ant Design 按当前算法派生主色、悬浮色、按下色、信息色和其他语义色。字体族、文本层级、背景、圆角及表单焦点状态使用 Ant Design 默认令牌。弹窗遮罩沿用 Ant Design 默认样式，暗色弹窗细边框取自 `colorBorderSecondary`。

CSS 变量键为 `sql-studio-theme`。工作区、Agent 与弹窗通过这个作用域读取 Ant Design CSS 变量。字号和主题由 `useThemePreference` 保存后应用。`--selection` 从当前主色派生，供页面文本和 SQL 编辑器选区共用。

左侧导航、工作区页签、连接类型、设置分类、对象树和会话列表在亮暗主题下共用 `--surface-selected`（`colorFillSecondary`）作为中性选中底。普通导航项和工作区页签使用 `controlItemBgHover` 悬浮底。选中页签标签和左侧导航图标沿用主题文本色，当前项指示线和已连接引擎底板使用主色。AI 图标底板使用 `colorPrimaryBg`，过程卡片使用中性填充 `colorFillAlter`。
