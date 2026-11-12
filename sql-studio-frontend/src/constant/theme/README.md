# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（Ant Design 默认）和 large（16px）。无状态、请求和持久化。

参照 ghspace-polardb-web：正文、标题、标签及 Typography 普通/次级/描述文字为纯黑或纯白，布局背景为 #ececec / #000。字体和圆角沿用 Ant Design；禁用和状态色保留原生语义。Button 不设置组件颜色或交互 token，按钮采用 default 类型并沿用原生悬停/按下效果；Typography 链接使用组件 token 保持正文色，并通过 linkHoverDecoration 设置悬停及按下的下划线。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive 使用 colorFillSecondary，controlItemBgActiveHover 使用 colorFill。表格勾选行也继承这两个原生 token。工作区主页面由主题绿色底线标记当前页，主题和字号卡片由 Radio 圆点标记选中。

主色 colorPrimary 使用 antdTheme.defaultSeed.colorSuccess（当前默认 #52c41a），通过亮暗算法自动派生悬停、按下和焦点色。Radio、Switch、Checkbox、页码和页签指示线等主色元素统一使用绿色；选中背景使用中性灰，常规按钮使用原生 default 外观，不重写 success/error/warning 状态色。
