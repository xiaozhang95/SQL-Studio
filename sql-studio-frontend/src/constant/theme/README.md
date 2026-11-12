# 主题配置

createThemeConfig(themeMode: ThemeMode, fontSizeMode: FontSizePreference = 'standard'): ThemeConfig 为 App 提供统一主题。模式为 light/dark，字号支持 small（12px）、standard（Ant Design 默认）和 large（16px）。无状态、请求和持久化。

参照 ghspace-polardb-web：正文、标题、标签及 Typography 普通/次级/描述文字为纯黑或纯白，布局背景为 #ececec / #000。字体和圆角沿用 Ant Design；禁用和状态色保留原生语义。Button 描边交互与链接颜色通过组件 token 保持灰阶，primary 的中性外框与链接悬停下划线仍在 app.scss。

保留 CSS 变量 key，工作区、Agent 与 AntApp 弹框共用此配置。字号与主题由现有 useThemePreference 保存后应用。
