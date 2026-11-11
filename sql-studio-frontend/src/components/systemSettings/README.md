# 系统设置入口

SystemSettings 接收 themeMode 与 AppearancePreferences（主题、字号、回调和可选 themeReady，默认 true），由工作区和 AI 助手共用。入口位于两页顶栏左侧按钮组末尾，与其他按钮垂直居中对齐；使用齿轮图标加「系统设置」文字的 text Button，保留 aria-label 和展开状态。

Ant Design Dropdown 从按钮左缘向右展开 400px 宽的面板，最大宽度为视口减 24px，最大高度为视口减 72px，必要时滚动。背景、间距、圆角及阴影使用原生 token。

- 上方以“模型配置”为分组标题，排版与“主题模式”“界面字号”保持相同层级，标题与表单间使用 small 间距。直接展示 AISettings 的服务商、Key、模型配置，不设二级入口或返回按钮；当前只提供 DeepSeek。保存和移除共用后端 ai 分区，成功关闭面板，忙碌时禁止外部关闭。
- 分隔线下为主题和字号：两组选项均占满 100% 宽度。主题为 system/light/dark，字号为 small/standard/large，对应较小（12px）、标准（默认 14px）、稍大（16px），默认标准；受全局 AppearancePreferences 控制，恢复期间禁用。
- 模型配置仅在面板打开时挂载，关闭即取消请求并清理输入。外观切换保持面板展开，点击外部或 Escape 关闭；各标题使用 useId 避免两页同时挂载时重复。
