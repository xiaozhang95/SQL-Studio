# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（14px）和 large（16px）；普通文本、表头、编辑器和设置控件统一随全局字号变化，Tag 等组件的小号文字继续沿用 Ant Design 默认比例。无状态、请求和持久化。

全局正文、标题和标签使用纯黑 `#000000` / 纯白 `#ffffff`，次级说明仍使用 Ant Design 灰阶；布局背景为 `#f4f6f2` / `#0a0a0a`，面板为 `#ffffff` / `#131313`，次级面板为 `#f8faf6` / `#1a1a1a`。暗色背景、边框和填充使用中性黑灰，不掺绿色调，绿色仅保留在主色与状态语义。Typography 沿用当前 Ant Design 主题的文本层级和链接样式。字体族不覆盖，圆角沿用组件默认值。

主色亮色为 `#15803d`、暗色为 `#42d47c`；success 分别为 `#16a34a` / `#42d47c`，warning 为 `#b45309` / `#fbbf24`，error 为 `#dc2626` / `#f87171`。暗色下 `colorTextLightSolid` 使用深色 `#06170c`；主按钮及其交互状态沿用主题算法。已连接引擎底板使用实色品牌绿 `--brand`，Rail 活动项、AI 欢迎卡和助手图标共用 `--primary-soft`。该底色取当前主题主色，亮暗模式的不透明度均为 12%。深色 Tooltip 气泡通过 app.scss 单独使用亮色文字。信息色 colorInfo 与主色共用绿色。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。Button 的 `primaryShadow`、`defaultShadow` 和 `dangerShadow` 在亮暗主题下统一设为 `none`，按钮悬停、按下和键盘焦点沿用原生反馈。

表单控件的焦点阴影共用 1px 扩展宽度和 20% 状态色，正常、警告、错误分别取主色、警告色、错误色。控件边框和键盘焦点轮廓沿用各组件的原生样式。

Alert 的信息、成功、警告、错误统一使用当前主题面板色与 12% 对应状态色混合的底色，描边使用 24% 对应状态色。`filled` 和 `banner` 沿用原生无可见描边样式，正文和图标沿用原生语义色。

Steps 的完成图标底色由当前面板色与 12% 主色混合，当前步骤使用原生实色强调。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive、controlItemBgActiveHover 与 controlItemBgHover 使用同一中性填充；Button 的 textHoverBg/defaultHoverBg/defaultActiveBg 也使用同一 palette.hover/active，Rail、页签、表格和卡片的自定义 hover 统一走 `--surface-hover`，避免不同控件出现两档悬停背景；表格勾选行继承选中 token。当前页签使用绿色底线，主题、字号和语言卡片使用统一的中性边框，选中状态由原生单选圆点表示。colorBorder 使用 `#cfd7cd` / `#3a3a3a`，colorBorderSecondary 使用发丝线 `#e2e7df` / `#282828`；弹窗沿用 Ant Design 默认圆角，遮罩色分别为 `rgba(18,24,19,.38)` / `rgba(0,0,0,.62)`。

暗色主题采用独立调色板，主操作、活动导航和选中线使用绿色，普通文字和边框保持中性。全局 Rail 与右侧面板共用 `colorBgContainer`，亮色为 `#ffffff`，暗色为 `#131313`。每个操作面只有一个 primary 操作。
