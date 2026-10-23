# 主题偏好

[源码](index.ts)

返回 preference、setPreference、mode。保存 system/light/dark，监听系统配色并在首帧前更新 data-theme。ConfigProvider 仅选择默认主题算法和 CSS 变量作用域，不覆盖默认文字、placeholder 或图标颜色。必要的组件覆盖统一在 src/app.scss；保留原生颜色。
