# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（Ant Design 默认）和 large（16px）。无状态、请求和持久化。

参照 ghspace-polardb-web：正文、标题、标签及 Typography 普通/次级/描述文字为纯黑或纯白，布局背景为 #ececec / #000。字体和圆角沿用 Ant Design；禁用和状态色保留原生语义。Button 不设置组件颜色或交互 token，按钮采用 default 类型并沿用原生悬停/按下效果；Typography 链接保持正文色及悬停下划线。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。

选中状态统一由 controlItemBgActive / controlItemBgActiveHover 提供，分别使用当前主题的 colorPrimary / colorPrimaryHover，导航与候选项使用浅色文字。设置分类、数据库类型、对象树、会话列表及工作区/结果页签统一使用主题实底；Select、Menu、Tree 同步浅色选中文字。主题和字号卡片只使用 Radio 圆点。Table 数据行使用 colorPrimaryBg / colorPrimaryBgHover 浅色衬底，保留状态文字、NULL 和编辑控件的可读性。

主色 colorPrimary 使用 antdTheme.defaultSeed.colorSuccess（当前默认 #52c41a），通过亮暗算法自动派生悬停、按下和焦点色。Radio、Switch、Checkbox、页码和页签指示线等主色元素统一使用绿色；选中态使用主题色，常规按钮使用原生 default 外观，不重写 success/error/warning 状态色。

连接弹窗的数据库类型选项单独使用 colorPrimary 实色激活背景及浅色文字，选中图标增加浅色描边；与其他导航选中态一致。
