# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（14px）和 large（16px）；普通文本、表头、编辑器和设置控件统一随全局字号变化，Tag 等组件的小号文字继续沿用 Ant Design 默认比例。无状态、请求和持久化。

全局正文、标题和标签使用纯黑 `#000000` / 纯白 `#ffffff`，次级说明仍使用 Ant Design 灰阶；布局背景为 `#f4f6f2` / `#0a0a0a`，面板为 `#ffffff` / `#131313`，次级面板为 `#f8faf6` / `#1a1a1a`。暗色背景、边框和填充使用中性黑灰，不掺绿色调，绿色仅保留在主色与状态语义。Typography 沿用当前 Ant Design 主题的文本层级和链接样式。字体族不覆盖，圆角沿用组件默认值。

主色亮色为 `#15803d`、暗色为 `#42d47c`；success 分别为 `#16a34a` / `#42d47c`，warning 为 `#b45309` / `#fbbf24`，error 为 `#dc2626` / `#f87171`。暗色下 `colorTextLightSolid` 使用深色 `#06170c`；主按钮通过 Button 组件 token 单独使用品牌深绿 `#15803d`（悬停 `#1a9348`、按下 `#116532`）和白色文字。app.scss 另提供实色品牌绿 `--brand: #15803d`，主按钮、已连接引擎底板和 Rail 激活块共用同一实色，不再混用半透明浅绿；图标和强调仍使用亮绿主色。深色 Tooltip 气泡通过 app.scss 单独使用亮色文字。信息色 colorInfo 与主色共用绿色。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive、controlItemBgActiveHover 与 controlItemBgHover 使用同一中性填充；Button 的 textHoverBg/defaultHoverBg/defaultActiveBg 也使用同一 palette.hover/active，Rail、页签、表格和卡片的自定义 hover 统一走 `--surface-hover`，避免不同控件出现两档悬停背景；表格勾选行继承选中 token。当前页签使用绿色底线，外观卡片使用主题色边框、浅色底和勾选标记。colorBorder 使用 `#cfd7cd` / `#3a3a3a`，colorBorderSecondary 使用发丝线 `#e2e7df` / `#282828`；弹窗组件 token 统一 12px 圆角，遮罩色分别为 `rgba(18,24,19,.38)` / `rgba(0,0,0,.62)`。

暗色主题采用独立调色板，不做简单反相；主操作、活动导航和选中线使用绿色，普通文字和边框保持中性。全局 Rail 使用独立 `--rail-surface`：亮色 `#f8faf6`、暗色 `#111111`，比次级面板更深一档。每个操作面只有一个 primary 操作；Button token 只额外覆盖深色主按钮的品牌绿底与白字，实色品牌面统一使用 `--brand`。