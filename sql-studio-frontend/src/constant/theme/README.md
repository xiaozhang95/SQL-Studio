# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（Ant Design 默认）和 large（16px）。无状态、请求和持久化。

全局正文、标题和标签使用纯黑或纯白，布局背景为 #ececec / #000。Typography 沿用当前 Ant Design 主题的文本层级和链接样式。字体、圆角与禁用状态沿用组件默认值。常规按钮采用 default 类型及原生悬停和按下效果。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive 使用 colorFillSecondary，controlItemBgActiveHover 使用 colorFill。表格勾选行也继承这两个原生 token。工作区主页面由主题绿色底线标记当前页，主题和字号卡片由 Radio 圆点标记选中。

主色 colorPrimary 使用 antdTheme.defaultSeed.colorSuccess（当前默认 #52c41a），通过亮暗算法自动派生悬停、按下和焦点色。Radio、Switch、Checkbox、页码和页签指示线等主色元素统一使用绿色；选中背景使用中性灰，常规按钮使用原生 default 外观，不重写 success/error/warning 状态色。

信息色 colorInfo 与主色共用绿色。信息提示保留原有语义与图标，背景和边框由亮暗主题算法派生。默认端口等普通标签使用中性色。
