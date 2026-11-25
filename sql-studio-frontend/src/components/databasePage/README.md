# 数据库功能页布局

`DatabasePage` 为监控和同步页面提供共享的错误通栏与可滚动内容区。全局 Rail 承载页面切换和系统设置。

## 参数

- `title`：已翻译的页面名，作为正文区域的可访问名称。
- `children`：页面内容。
- `errors`：当前页面业务错误，与连接错误合并展示。
- `connectionError` / `retryConnections`：连接读取失败时的错误与重试操作。
- `onBack`：供同步页的返回工作区操作使用。

正文背景使用 `colorBgContainer`，与工作台及 AI 助手的主内容区一致。正文铺满主区域宽度，内边距和区块间距分别使用 Ant Design `padding`、`margin`，底部使用 `paddingXL`。错误通栏位于正文上方，正文独立滚动。
