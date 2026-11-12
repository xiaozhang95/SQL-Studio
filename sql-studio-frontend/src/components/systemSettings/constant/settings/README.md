# 系统设置定义

SettingsSection 提供 model/theme/font-size 三个导航项及对应联合类型；settingsSections 集中导航名称与 Ant Design 图标组件。settingsGroups 将模型配置归入“模型服务”，将主题模式和界面字号归入“外观设置”，复用导航项定义；分组标题仅用于展示。themeOptions 定义 system/light/dark 主题选项，fontSizeOptions 定义 small/standard/large 的名称与示例字号（12/14/16px），使用共享偏好类型约束。

settingsLayout 集中弹框宽度（860px）、内容高度上限（440px，实际受视口减 180px 限制）、侧栏宽度上限（180px）、卡片预览高度（96px）与卡片最小宽度（132px，窄内容区可继续收缩并换行）。只读定义由系统设置及其私有组件、状态 hook 引入，不覆盖 Ant Design 原生控件尺寸。
