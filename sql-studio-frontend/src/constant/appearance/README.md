# 统一控件外观

[源码](index.ts)

ComponentSize 是 Small/Middle/Large 的 as const 尺寸枚举，类型由值推导。appearance 统一约定常规控件 middle，数据表、分页与页面导航 small、范围/结果选择器宽度 220px、工作区面板标题及工具栏高度 42px、全局 Rail 图标 20px。

圆角沿用 Ant Design 默认 token，App 不设置全局 borderRadius 覆盖，appearance 不维护圆角数值。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

## 按钮层级

- 每个页面或弹窗操作面只设置一个 primary 主操作：工作台「运行」、AI「发送」、同步「同步检查/开始同步」、设置与连接弹窗「保存」。
- 常规次级操作使用 default；工具栏和低频操作使用 text/icon，并提供 Tooltip 与可访问名称。
- Modal 与 AntApp 确认弹窗通过 modalDefaults 将确认按钮默认为 default；桌面退出时的查询保存确认使用 primary，写入确认可使用 warning 按钮，危险与禁用语义保留。
- 主按钮的悬停、按下颜色和阴影沿用 [Ant Design 主题算法](../theme/README.md)。
- 键盘聚焦时在按钮内绘制当前文字色的细线，鼠标点击沿用组件自身的按下样式。

## 面板与弹窗

Modal 与 AntApp 确认弹窗使用 Ant Design 容器外观，沿用默认位置。暗色模式通过 app.scss 为面板统一添加 1px colorBorder 描边。系统设置弹窗宽 920px、内容高度上限 532px（同时不超过视口减 240px），左右内容独立滚动。

`formModalStyles` 是连接与系统设置弹窗共用的语义样式。标题行最小 52px、底栏最小 58px，水平内边距为 Ant Design `padding`，分隔线随主题切换。标题、正文、分栏和底栏共用 Modal 的 `colorBgElevated` 底色。业务表单使用左侧标签与右侧控件。

railButtonStyle 供全局导航和设置图标入口共用尺寸及主题圆角。
