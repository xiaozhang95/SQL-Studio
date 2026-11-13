# 系统设置定义

SettingsSection 提供 model/appearance/language/about 导航项及对应联合类型；settingsSections 集中导航名称与 Ant Design 图标组件。settingsGroups 将模型配置归入“模型服务”，将「外观设置」「语言设置」「关于软件」归入“偏好设置”。themeOptions 定义 system/light/dark 主题选项，fontSizeOptions 定义 small/standard/large 的名称与示例字号（12/14/16px）；两组选项在同一外观页展示。languageOptions 定义 zh-CN/en-US 卡片的原生名称、标题与示例。只读定义使用共享偏好类型约束，展示标签由消费组件按当前语言翻译，语言卡片保留各自原生文字。

settingsLayout 集中弹框宽度（860px）、内容高度上限（440px，实际受视口减 180px 限制）、侧栏宽度上限（180px）、卡片预览高度（96px）与卡片最小宽度（132px，窄内容区可继续收缩并换行）。只读定义由系统设置及其私有组件、状态 hook 引入，不覆盖 Ant Design 原生控件尺寸。
