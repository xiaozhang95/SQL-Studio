# 工作区契约

[源码](index.ts)

QueryScope 保存连接/库/表；WorkspaceTab 保存页面 kind/id/title/sql。RunState/StatementRun 描述一批执行和各条结果，ResultView 保存选中结果、筛选与分页。HistoryItem 保存发起连接、SQL、时间、耗时和错误。

WorkspaceSnapshot 是本地加密持久化白名单：页面、范围、SQL、结果、编辑位置、树布局、结果高度、打开连接 ID 与未完成批次标识；不包含连接密码或表单对象。EditorLayout/ExplorerLayout 只保存视图状态，恢复不触发 SQL。

WorkspaceSnapshot.sidebarWidth 为可选对象栏宽度，用于兼容旧快照；缺少或无效时使用默认 272px，新保存的快照记录用户调整后的宽度。
