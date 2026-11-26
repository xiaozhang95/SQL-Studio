# 主题配置

`createThemeConfig(themeMode, fontSizeMode = 'standard')` 返回 App 使用的 Ant Design `ThemeConfig`。`themeMode` 选择亮色或暗色算法，`fontSizeMode` 通过主题和设置预览共用的 `uiFontSizes` 选择 12、14 或 16px。控件高度为 30px。函数无状态、请求和持久化。

亮暗主题的 `colorPrimary` 都使用 [Logo 放大镜描边](../../../public/studio.svg) 的蓝色 `#2569DF`。Ant Design 按当前算法派生悬浮色、按下色、信息色和其他语义色。亮色布局底为 `#f0f0f0`，工作台、编辑器、Redis 终端和应用加载界面共用容器底 `#f5f5f5`。暗色布局底和容器底沿用 Ant Design 默认令牌。亮色浮层底为 `#f7f7f7`，暗色浮层底为接近主内容背景的 `#181818`。字体族、圆角及表单焦点状态沿用组件默认值。Typography 的正文、标题和次级说明、Statistic 的指标标签以及 Tabs 页签的正常交互状态共用全局正文色 `colorText`。链接和状态文字使用各自的语义色。弹窗遮罩沿用 Ant Design 默认样式，暗色弹窗边框取自 `colorBorder`。

CSS 变量键为 `sql-studio-theme`。工作区、Agent 与弹窗通过这个作用域读取 Ant Design CSS 变量。字号和主题由 `useThemePreference` 保存后应用。`--selection` 从当前主色派生，供页面文本和 SQL 编辑器选区共用。

工作区（含 SQL 编辑器、结果区和 Redis 工具）、AI 助手、监控和同步的主内容区共用 `colorBgContainer`。Modal、Drawer 的内容区继承浮层底色 `colorBgElevated`。只读 SQL 预览与共用分页底栏随所在页面、浮层或卡片显示背景。

`colorBorder`、`colorBorderSecondary` 和 `colorSplit` 共用低对比度的中性边框色，亮色为 `#e2e2e2`，暗色为 `#242424`。布局分隔线、卡片、表格和普通控件边框都读取这组令牌。在各主题的布局、容器和浮层背景上保留细微的分隔线。输入焦点和校验状态使用各自的语义色。

`controlItemBgActive` 和 `controlItemBgActiveHover` 使用同一个不透明的中性选中底，亮色为 `#e6e6e6`，暗色为 `#303030`。Ant Design 下拉选项、树节点和表格选中行沿用这组令牌。自定义的左侧主导航、连接类型、设置分类、对象树、工作区卡片页签、会话列表、Redis 工具和频道列表通过 `--surface-selected` 引用同一颜色。主题、字号和语言卡片沿用弹窗底色，通过 Radio 圆点标记当前选项。

左侧主导航与设置分类的选中图标共用 `--navigation-icon-selected`，在暗色模式使用白色，在亮色模式使用主题正文色。主导航普通入口的图标使用次级文字色，悬停或按下时使用正文色。工作区卡片页签采用中性边框，标签和图标沿用默认文字色。线形页签由原生活动线标记当前项。普通导航项和工作区页签使用 `controlItemBgHover` 悬浮底，结果表表头使用 `colorFillAlter`。AI 欢迎卡片图标的底板使用 `colorPrimaryBg`，图标在亮色下使用主色、暗色下使用正文色。助手正文与行内过程入口沿用会话容器底色。
