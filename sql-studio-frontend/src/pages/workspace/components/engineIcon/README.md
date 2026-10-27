# 数据库状态图标

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

type? 为 DatabaseType，省略按 MySQL 处理；variant? 默认为 icon，连接类型与表单头部使用 logo（40px）；connected? 默认为 true，连接根节点必须传入实际结构加载状态。

size?:number 显式控制像素尺寸；省略时 logo 为 40、icon 为 32，树和连接下拉传 20。尺寸、状态底色和图片布局由组件 style 表达，不依赖父容器选择器。

图标地址和产品样式类读取 getDatabaseAdapter(type).profile，组件只渲染受控状态；不直接导入 MySQL 图片或在此维护产品分派。

## 行为与边界

MySQL 与 PolarDB 都使用官方品牌图形和透明底板，图片保持原色。icon 模式通过旁边的 success/灰色小圆点标记已连接/未连接，状态圆点位于品牌图片之上；logo 模式只显示品牌图形。树和连接下拉为 20px，表单头部为 40px，类型列表传 32px。折叠不改变连接状态。数据库、schema、表和视图沿用原生语义图标。

图标为装饰，名称由相邻文字提供；资源归属与来源见 [资产说明](../../../../assets/databases/README.md)。页面私有组件从目录导入，不通过聚合出口扩散依赖。

profile.iconPresentation=brand 时使用透明底板和原始品牌图片，不套 success/灰色背景。icon 模式在右下角用主题 success/disabled 小圆点表示连接状态，logo 模式仅展示官方图形；尺寸及其他引擎行为保持统一。
