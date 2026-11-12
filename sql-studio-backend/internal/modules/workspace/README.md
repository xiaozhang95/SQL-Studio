# 分片工作区模块

New(repository) 注入 ReadWorkspace/CommitWorkspace/ReadWorkspacePart；Read 返回当前 v2 轻量索引，Part 读取64位散列内容，Commit 校验当前索引、页面唯一性、范围、草稿与结果后 CAS 提交。只消费 model 与仓库接口，不访问文件或数据库。

每份草稿/结果最多32MiB，总请求限96MiB加信封；提交仅包含变化内容。修订冲突返回 model.ErrStateConflict，不自动重试覆盖；context 贯穿。只处理最新工作区格式，不提供旧格式读写或转换。

成功提交后独立安排 CollectWorkspaceParts，最多一个任务、5秒节流、30秒context，每批最多128个候选；回收失败记录日志，不把已完成保存报告为失败，也不阻塞保存响应。
