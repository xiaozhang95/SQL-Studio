# 页面标题

`queryPageContext(page): string` 从该查询页的 database/schema 派生数据库范围，格式为「库 / Schema」；未选库或非查询页返回空字符串。

`workspacePageTitle(page): string` 返回「数据库范围 · 原标题」，例如 `sql_studio_demo · 查询 1`；未选库和对象/设计页保留原标题。两个方法只消费 WorkspaceTab 的 kind/title/database/schema，不修改页面、SQL、执行范围或保存格式，不读取树选中状态和结果快照。

WorkspaceTabs 用它们组合可见标题和悬停全文。切库、成功 USE、Schema 变化、关闭范围或恢复页面后，直接按当前页面范围重新派生；导入文件名等原始名称始终保留，不反复添加前缀。
