# 统一控件外观

[源码](index.ts)

ComponentSize 是 Small/Middle/Large 的 as const 尺寸枚举，类型由值推导。appearance 通过 Ant Design 的 Button/Table/Tabs 类型及 satisfies 约束统一约定：常规控件和分页 middle、数据表与页面导航 small、范围/结果选择器宽度 220px。

圆角沿用 Ant Design 默认 token，App 不再设置全局 borderRadius 覆盖，appearance 不维护圆角数值。不得在业务组件中随意另设字号、边框、弧度或混用尺寸。局部布局使用 style/styles，确需覆盖原生选择器时只放 app.scss。

Modal 与 AntApp 确认弹窗使用 Ant Design 容器外观。暗色模式通过 app.scss 为面板统一添加 1px colorBorder 描边，与外观选项卡使用相同颜色。

常规操作按钮统一使用 Ant Design default 类型，不再用 primary 再覆盖成普通外观。Modal 及 AntApp 的默认确认按钮通过 modalDefaults（ConfigProviderProps.modal 类型约束）统一配置，Popconfirm 显式使用 okType=default。危险、禁用、加载及回调语义保留，工具栏图标和链接操作按原有 text/link 类型展示。

按钮默认、悬停、按下、焦点的颜色、背景、边框及阴影全部沿用 Ant Design 默认值，不在 theme.Button 或 app.scss 中额外覆盖；主色仍由 constant/theme 使用 success 绿色。Typography 链接继续使用正文色及悬停下划线。
