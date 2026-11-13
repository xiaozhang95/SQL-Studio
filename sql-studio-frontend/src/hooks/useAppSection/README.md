# 功能入口

`useAppSection()` 使用浏览器 History API 管理页面，返回 agent、openAgent() 和 openWorkspace()。`/` 为 SQL 工作区，`/agent` 为 AI 助手；读取 pathname 判断页面，接受助手路径末尾的斜杠。切换使用 pushState，保留查询参数并清除片段，重复点击当前路径不新增历史记录。内部导航事件通知 React，浏览器前进、后退通过 popstate 更新；卸载移除订阅，不整页刷新或额外保存路由状态。

工作区保持挂载以保留未保存草稿，Agent 离开时沿用自身取消流和保存布局的流程。Vite 使用 SPA 模式提供开发入口；Go 为 `/agent` 显式提供同一个 index.html，刷新和直接访问由服务端入口支持。Electron 使用同源 HTTP 页面，沿用这两条路径。
