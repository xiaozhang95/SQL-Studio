# 工作区契约

[源码](index.ts)

QueryScope 保存连接/库/表；WorkspaceTab 保存页面 kind/id/title/sql。RunState/StatementRun 描述一批执行和各条结果，ResultView 保存选中结果、筛选与分页。HistoryItem 保存发起连接、SQL、时间、耗时和错误。

WorkspaceSnapshot 是本地加密持久化白名单：页面、范围、SQL、结果、编辑位置、树布局、结果高度、打开连接 ID 与未完成批次标识；不包含连接密码或表单对象。EditorLayout/ExplorerLayout 只保存视图状态，恢复不触发 SQL。

WorkspaceSnapshot.sidebarWidth 为可选对象栏宽度，用于兼容旧快照；缺少或无效时使用默认 272px，新保存的快照记录用户调整后的宽度。

StatementRun.durationMs 为可选语句请求耗时（失败时仍记录）；RunState.startedAt/endedAt 为可选 ISO 时间，durationMs 为前端批次运行耗时。成功语句显示后端 QueryResult.durationMs，失败显示语句请求耗时；旧快照没有字段时显示未记录。只记录实际执行，不为未执行语句创建输出，刷新中断不伪造结束时间。

WorkspacePageKind 增加 table-create/table-design，复用页面的连接/库/表范围。表设计草稿不放在 sql 字段或运行结果中，由各设计页组件独立持有；快照只保存这些页面的描述和范围，恢复不执行写入。
