# 数据库功能页布局

`DatabasePage` 为监控和同步页面提供共享的上下文 Header 与画布内容布局。全局 Rail 已承载页面切换和系统设置，因此本组件不再渲染返回入口或系统设置按钮。

## 参数

- `title`：已翻译的页面标题，传给 PageHeader。
- `breadcrumb`：可选页面范围，例如连接名或「源 → 目标」。
- `headerActions`：当前页状态和操作，例如采样状态、同步状态。
- `contentWidth`：内容最大宽度，监控默认 1380px，同步传 1120px。
- `children`：页面内容。
- `errors`：当前页面业务错误，与连接错误合并展示。
- `connectionError` / `retryConnections`：连接读取失败时的错误与重试操作。
- `onBack`：保留给需要主动返回工作区的页面操作，不用于 Header 导航。

正文使用 `--canvas` 背景，最大宽度内居中，内边距 18 × 22px，区块间距 token.marginMD；页面内容独立滚动。Header、错误条和正文使用纵向 flex 排列，页面根节点高度由全局内容区约束。