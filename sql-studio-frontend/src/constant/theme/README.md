# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（13px）和 large（15px）。无状态、请求和持久化。

全局正文、标题和标签使用近黑 `#161a16` / 近白 `#f2f5f1`；布局背景为 `#f4f6f2` / `#0a0c0a`，面板为 `#ffffff` / `#121512`，次级面板为 `#f8faf6` / `#181c18`。Typography 沿用当前 Ant Design 主题的文本层级和链接样式。字体族不覆盖，圆角沿用组件默认值。

主色亮色为 `#15803d`、暗色为 `#42d47c`；success 分别为 `#16a34a` / `#42d47c`，warning 为 `#b45309` / `#fbbf24`，error 为 `#dc2626` / `#f87171`。暗色下 `colorTextLightSolid` 使用深色 `#06170c`，保证亮绿主按钮上的文字对比。信息色 colorInfo 与主色共用绿色。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive、controlItemBgActiveHover 与 controlItemBgHover 使用同一中性填充；表格勾选行继承选中 token。当前页签使用绿色底线，外观卡片使用主题色边框、浅色底和勾选标记。

暗色主题采用独立调色板，不做简单反相；主操作、活动导航和选中线使用绿色，普通文字和边框保持中性。每个操作面只有一个 primary 操作，不再通过全局 Button token 覆盖主按钮颜色。