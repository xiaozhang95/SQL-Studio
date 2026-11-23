# 统一控件外观

[源码](index.ts)

ComponentSize 是 Small/Middle/Large 的 as const 尺寸枚举，类型由值推导。appearance 通过 Ant Design 的 Button/Table/Tabs 类型及 satisfies 约束统一约定：常规控件 middle，数据表、分页与页面导航 small、范围/结果选择器宽度 220px。

圆角沿用 Ant Design 默认 token，App 不设置全局 borderRadius 覆盖，appearance 不维护圆角数值。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

## 按钮层级

- 每个页面或弹窗操作面只设置一个 primary 主操作：工作台「运行」、AI「发送」、同步「同步检查/开始同步」、设置与连接弹窗「保存」。
- 常规次级操作使用 default；工具栏和低频操作使用 text/icon，并提供 Tooltip 与可访问名称。
- Modal 与 AntApp 确认弹窗通过 modalDefaults 统一确认按钮为 default；写入确认可使用 warning 按钮，危险与禁用语义保留。
- 主按钮的悬停与按下颜色由主题算法派生。按钮底部投影由[全局 Button 主题](../theme/README.md)统一移除。

## 面板与弹窗

Modal 与 AntApp 确认弹窗使用 Ant Design 容器外观，沿用默认位置。暗色模式通过 app.scss 为面板统一添加 1px colorBorder 描边。系统设置弹窗宽 920px、内容高度上限 532px（同时不超过视口减 240px），左右内容独立滚动。

连接、AI 配置、对象管理及 AntApp 确认弹窗使用统一 Header 52px、Footer 56px 和 20 × 24px 内容内边距；业务表单继续左侧标签、右侧控件。

railButtonStyle 供全局导航和设置图标入口共用尺寸及主题圆角。
