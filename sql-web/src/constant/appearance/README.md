# 统一控件外观

[源码](index.ts)

ComponentSize 是 Small/Middle/Large 的 as const 尺寸枚举，类型由值推导。appearance 通过 Ant Design 的 Button/Table/Tabs 类型及 satisfies 约束统一约定：常规控件和分页 middle、数据表与页面导航 small、范围/结果选择器宽度 220px。

borderRadius=0 为用户此前明确要求的全局方角例外，只由 App 的主题 token 使用；其他属性沿用 Ant Design 默认。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

modalStyles 使用 ModalProps 的公开样式类型约束，通过 App 的 ConfigProvider.modal.styles 为所有 Modal 及 AntApp modal.confirm 统一增加 colorBorder 的 1px 外框，随亮暗主题切换。连接、AI 配置、优化建议、库表操作及确认弹窗共用，不逐组件重复维护；默认阴影、背景和内部布局保持原组件配置。
