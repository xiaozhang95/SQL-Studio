# 内容区加载

`ContentLoading({ label, className? })` 是工作台与 AI 助手共用的内容区加载组件。`label` 为加载说明，`className` 可选，用于在 `app.scss` 中定位业务区域的容器布局，例如保存后刷新结果时的遮罩。组件居中填满可用空间，图标、尺寸、颜色及说明沿用 Ant Design `Spin` 默认样式。

页面、标签内容、查询结果、会话和过程详情等独立加载提示复用该组件。包裹已有内容的 `Spin` 使用 Ant Design 原生受控用法，按钮和标签图标使用各自的状态入口。
