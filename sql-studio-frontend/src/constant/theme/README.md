# 主题配置

`createThemeConfig(themeMode, fontSizeMode = 'standard')` 返回 App 使用的 Ant Design `ThemeConfig`。`themeMode` 选择亮色或暗色算法，`fontSizeMode` 通过主题和设置预览共用的 `uiFontSizes` 选择 12、14 或 16px。控件高度为 30px。函数无状态、请求和持久化。

亮暗主题的 `colorPrimary` 都使用 [Logo 放大镜描边](../../../public/studio.svg) 的蓝色 `#2569DF`。Ant Design 按当前算法派生悬浮色、按下色、信息色和其他语义色。亮色布局底为 `#f0f0f0`，工作台、编辑器、Redis 终端和应用加载界面共用容器底 `#f5f5f5`，浮层底为 `#f7f7f7`。暗色容器底色、布局底色和浮层底色沿用 Ant Design 默认令牌。字体族、圆角及表单焦点状态沿用组件默认值。Typography 的普通正文、标题和次级说明，以及 Statistic 的指标标签，使用当前系统配色的 `CanvasText`。链接和状态文字使用各自的语义色。弹窗遮罩沿用 Ant Design 默认样式，暗色弹窗边框取自 `colorBorder`。

CSS 变量键为 `sql-studio-theme`。工作区、Agent 与弹窗通过这个作用域读取 Ant Design CSS 变量。字号和主题由 `useThemePreference` 保存后应用。`--selection` 从当前主色派生，供页面文本和 SQL 编辑器选区共用。

工作区（含 SQL 编辑器、结果区和 Redis 工具）、AI 助手、监控和同步的主内容区共用 `colorBgContainer`。Modal、Drawer 的内容区继承浮层底色 `colorBgElevated`。只读 SQL 预览与共用分页底栏随所在页面、浮层或卡片显示背景。

`colorBorder`、`colorBorderSecondary` 和 `colorSplit` 共用中性边框色，亮色为 `#dedede`，暗色为 `#363636`。布局分隔线、卡片、表格和普通控件边框都读取这组令牌。输入焦点和校验状态使用各自的语义色。

左侧主导航、连接类型、设置分类、对象树、会话列表、Redis 工具和频道列表共用 `--surface-selected` 淡中性选中底。左侧主导航和设置分类的激活图标与选中指示线使用 `colorPrimary`。工作区卡片页签的选中底与结果表表头共用 `colorFillAlter` 叠加在容器底色上的效果，边框采用中性色，标签和图标沿用默认文字色。线形页签由原生活动线标记当前项。普通导航项和工作区页签使用 `controlItemBgHover` 悬浮底。AI 欢迎卡片和助手图标的底板使用 `colorPrimaryBg`，图标在亮色下使用主色、暗色下使用正文色。过程卡片使用中性填充 `colorFillAlter`。
