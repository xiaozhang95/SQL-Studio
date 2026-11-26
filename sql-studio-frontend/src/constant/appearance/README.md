# 统一控件外观

[源码](index.ts)

`appearance.controlSize` 由根 Provider 提供 `middle` 标准尺寸，按钮、输入框、下拉框、表格、分页、卡片和导航沿用对应组件的标准外观。按钮和输入类控件的主题标准高度为 30px。连接、数据库和 Schema 范围选择器的宽度上限为 240px，结果集选择器与筛选框宽度为 220px。工作区面板标题及工具栏高度为 42px，全局 Rail 图标含设置入口统一为 20px。

圆角沿用 Ant Design 默认 token，App 不设置全局 borderRadius 覆盖，appearance 不维护圆角数值。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

`tagDefaults` 通过全局 Provider 为 Ant Design Tag 设置 `variant='solid'`。成功、失败等状态由各自的 `color` 语义决定，无状态标签使用 Ant Design 默认实色。

## 按钮层级

- 每个页面或弹窗操作面只设置一个 primary 主操作：工作台「运行」、AI「发送」、同步「同步检查/开始同步」、设置与连接弹窗「保存」。
- 常规次级操作使用 default；工具栏和低频操作使用 text/icon，并提供 Tooltip 与可访问名称。
- Modal 与 AntApp 确认弹窗通过 modalDefaults 将确认按钮默认为 default；桌面退出时的查询保存确认使用 primary，写入确认可使用 warning 按钮，危险与禁用语义保留。
- 主按钮的悬停、按下颜色和阴影沿用 [Ant Design 主题算法](../theme/README.md)。
- 键盘聚焦时在 Button 内绘制当前文字色的细线，鼠标和触摸点击沿用组件自身的按下样式。文档级输入方式标记覆盖应用及弹窗门户，确保点击后的焦点还原也沿用指针样式。按钮波纹隐藏，一级菜单、工具栏和弹窗中的按钮遵循同一规则。

## 面板与弹窗

Modal 与 AntApp 确认弹窗使用 Ant Design 容器外观，沿用默认位置。暗色模式通过 app.scss 为面板统一添加 1px colorBorder 描边。系统设置弹窗宽 920px、内容高度上限 532px（同时不超过视口减 240px），左右内容独立滚动。

`formModalStyles` 是连接与系统设置弹窗共用的语义样式。标题行最小 52px、底栏最小 58px，水平内边距为 Ant Design `padding`，分隔线随主题切换。标题、正文、分栏和底栏共用 Modal 的 `colorBgElevated` 底色。业务表单使用左侧标签与右侧控件。

`railButtonStyle` 供全局导航和设置图标入口共用尺寸及默认 `borderRadius`。
