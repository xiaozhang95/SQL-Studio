# SQL 工作区

[源码](index.tsx) · [组件](components/README.md) · [hooks](hooks/README.md)

index.tsx 只组合顶栏新建连接/新建查询与主题、左侧连接、SQL 编辑与结果、连接弹窗和历史抽屉。业务状态位于 useWorkspace，主题由 App 提供。库、Schema、表和 SQL 随查询标签保存；执行和真实结果归属发起窗口。

整体布局集中在 src/app.scss，全局 src/app.scss 将布局颜色映射到 Ant Design 原生 CSS token；主色不单独定义。入口先加载 antd/dist/reset.css。库表选择在运行按钮前；历史入口固定在侧栏底部，记录默认折叠。移除品牌标题、侧栏重复标题/连接信息和对象/历史数量；只读状态合并进开关。图标引用品牌资产，信息 Tag 使用蓝色 solid，Button 使用组件默认样式。SQL 编辑器继承页面系统字体。

表操作通过对象树右键菜单发起；下方仅展示多个可关闭结果。分页固定在滚动区外。信息 Tag 按当前要求使用蓝色 solid，语义状态保留状态色。

## 布局修正

无结果时整个底部面板隐藏，查询编辑器填满剩余区域；结果表格双向滚动留在 Table body，分页位于滚动区外，避免滚动条裁切。
