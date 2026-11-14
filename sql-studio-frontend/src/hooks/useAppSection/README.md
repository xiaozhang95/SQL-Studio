# 页面路由

`useAppSection()` 使用 History API 管理 `section`。工作区、AI 助手、监控指标和同步数据库分别对应 `/`、`/agent`、`/monitor` 和 `/sync`。`openAgent()`、`openWorkspace()` 和 `openDatabaseSection(section, scope?)` 使用 pushState 切换，浏览器前进、后退通过 popstate 同步。

可选范围将已保存连接 ID 和监控数据库名写入 `connection`、`database` 查询参数，供前进、后退及刷新恢复入口预选值。其他查询参数保留，离开时清除这两个范围参数。工作区保持挂载以保留草稿；Go 显式将这些页面映射到同一入口，Electron 沿用同源路由。
