# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark。`uiFontSizes` 共供主题与设置预览使用，以 Ant Design 默认字号 14px 为标准，保留 ±2px 的字号偏好。普通文本、表头与编辑器随全局字号变化，Tag 等组件沿用自身默认层级。无状态、请求和持久化。

正文、标题、标签、次级说明及占位文本沿用 Ant Design 默认文本层级（亮色为 88% 黑、暗色为 85% 白，次级 65%、三级 45%、四级 25%），不覆盖文字色 token；布局背景为 `#f4f6f8` / `#0a0a0a`，面板为 `#ffffff` / `#131313`，次级面板为 `#f8fafc` / `#1a1a1a`。暗色背景、边框和填充使用中性黑灰；亮色中性色使用冷灰，不掺绿色调。主色为应用蓝，绿色仅保留在成功状态等语义。Typography 沿用当前 Ant Design 主题的文本层级和链接样式。字体族不覆盖，圆角沿用组件默认值。

亮暗主题的主色和信息色种子取自 [Logo 放大镜描边](../../../public/studio.svg) 的蓝色 `#2569DF`。Ant Design 派生按钮及交互色，实底按钮和 Tooltip 的文本沿用 `colorTextLightSolid`。已连接引擎底板与页签活动线使用 `--primary`，Rail 选中项和 AI 图标使用 12% 的主色浅底，暗色图标和代码前景使用同色系较亮的 `colorPrimaryHover`。文本选区也从主色派生。成功、警告和错误继续使用各自的语义色。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。Button、Alert、Steps、Modal 等组件 token 不单独覆盖，使用 Ant Design 按当前主题算法派生的默认实色、状态底色、阴影和悬停反馈。

暗色 Dropdown 的可用危险项在鼠标悬停时使用白色文字和图标，红底混入弹层底色以提高对比度。样式在 app.scss 限定到菜单危险项的悬停状态。

表单控件的焦点阴影共用 1px 扩展宽度和 20% 状态色，正常、警告、错误分别取主色、警告色、错误色。控件边框和键盘焦点轮廓沿用各组件的原生样式。

连接类型、设置分类、对象树、会话列表、结果页签及下拉选项共用中性灰选中底。controlItemBgActive、controlItemBgActiveHover 与 controlItemBgHover 使用同一中性填充；Rail、页签、表格和卡片的自定义 hover 统一走 `--surface-hover`，避免不同控件出现两档悬停背景；表格勾选行继承选中 token。当前页签使用主色底线，主题、字号和语言卡片使用统一的中性边框，选中状态由原生单选圆点表示。colorBorder 使用 `#cfd7de` / `#3a3a3a`，colorBorderSecondary 使用发丝线 `#e2e7ec` / `#282828`；弹窗沿用 Ant Design 默认圆角，遮罩色分别为 `rgba(17,24,39,.38)` / `rgba(0,0,0,.62)`。

暗色主题采用独立调色板，主操作、活动导航和选中线使用主色蓝，普通文字和边框保持中性。全局 Rail 与右侧面板共用 `colorBgContainer`，亮色为 `#ffffff`，暗色为 `#131313`。每个操作面只有一个 primary 操作。
