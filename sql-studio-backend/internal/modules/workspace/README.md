# 分片工作区模块

New(repository) 注入 ReadWorkspace/CommitWorkspace/ReadWorkspacePart 消费接口。Read(ctx) 返回 model.WorkspaceDocument 的轻量索引；Part(ctx,hash) 只读取64位SHA256内容；Commit(ctx,input) 校验v2索引、唯一页面、范围、草稿与结果对象，调用仓库CAS原子提交。模块不拼SQL、不访问数据库或文件。

每份草稿/结果最多32MiB，总请求由HTTP限96MiB加1MiB信封。一次提交只包含变化的页面内容，布局保留明确类型，结果为不执行的JSON对象。修订冲突由 model.ErrStateConflict 表达，不重试覆盖；context贯穿。仓库可实现 CollectWorkspaceParts，成功提交后每5秒至多清理一次旧孤立内容；清理失败不把已提交的保存报告成失败。

已迁移后旧格式 workspace 分区写入返回409，要求旧客户端刷新；不允许旧格式覆盖或与新索引分叉。回收最多每5秒检查一次，128MiB为孤立内容回收目标（不包括当前引用），不是所有用户结果的总容量限制。

回收在保存提交之后异步执行，不延迟成功响应；最多一个清理任务、5秒节流、独立30秒context，失败记录日志。请求取消不取消已经安排的回收，也不影响已提交结果。
