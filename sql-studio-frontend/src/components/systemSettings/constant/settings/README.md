# 系统设置定义

SettingsSection 提供 model/appearance/language/about 导航项及对应联合类型；settingsSections 集中导航名称与 Ant Design 图标组件。settingsGroups 将模型配置归入“AI”，将「外观设置」「语言设置」「关于软件」归入“通用”；themeOptions 依次定义 system（跟随系统）/light/dark，fontSizeOptions 定义 small/standard/large 的「较小（12px）/标准（14px）/稍大（16px）」名称与示例字号；两组选项在同一外观页展示。languageOptions 定义 zh-CN/en-US 的原生名称、示例标题与说明文字。只读定义使用共享偏好类型约束，展示标签由消费组件按当前语言翻译，语言卡片保留各自原生文字。

settingsLayout 集中弹框宽度（920px）、内容高度上限（532px，实际受视口减 240px 限制）、侧栏宽度（208px）、卡片预览高度（96px）与卡片最小宽度（132px，窄内容区继续换行）。只读定义由系统设置及其私有组件、状态 hook 引入，不覆盖 Ant Design 原生控件尺寸。