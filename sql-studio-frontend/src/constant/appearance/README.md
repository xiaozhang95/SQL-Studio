# 统一控件外观

[源码](index.ts)

ComponentSize 是 Small/Middle/Large 的 as const 尺寸枚举，类型由值推导。appearance 通过 Ant Design 的 Button/Table/Tabs 类型及 satisfies 约束统一约定：常规控件和分页 middle、数据表与页面导航 small、范围/结果选择器宽度 220px。

圆角沿用 Ant Design 默认 token，App 不再设置全局 borderRadius 覆盖，appearance 不维护圆角数值。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

所有 Modal 及 AntApp 确认弹窗的 1px 主题外框统一放在 app.scss，不在组件或配置对象中维护原生边框覆盖；其余属性保留默认值。

所有 primary 按钮统一使用中性背景、正文色和灰色边框，包括工作区、AI 助手以及弹框默认确认按钮；语义仍可使用 primary，视觉覆盖集中在 app.scss。悬停和按下为灰阶反馈，危险与禁用态保留原生语义，不修改全局主题主色。

link Button（如历史载入、对象操作）、Typography.Link（如 AI 回复链接）在默认/悬停/按下时使用正文色，悬停保留下划线反馈。普通描边按钮悬停/按下同样使用灰阶边框和背景；危险、禁用和键盘焦点语义保留。样式统一限定 sql-studio-theme，集中在 app.scss。
