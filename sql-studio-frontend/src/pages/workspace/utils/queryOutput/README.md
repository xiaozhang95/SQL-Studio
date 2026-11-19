# 查询与对象输出

[源码](index.ts)

statementOutputs(run: RunState) 返回本批 StatementRun[]；优先使用 statements，当前对象结果使用单条且 SQL 为空，没有输出时返回空数组。statementDuration(item) 返回后端结果耗时，失败时使用前端记录的请求耗时；对象结果未记录耗时返回 undefined，不伪造为 0。不读写状态或访问数据库。

`resultOutputs(run)` 返回包含数据列的结果及原始语句索引 `{item,index}`，包括零行 SELECT 和 RETURNING。`executionCancelled(item)` 支持新的取消标记和旧记录的取消文案。`defaultOutputView(run,index,running)` 让失败和取消落在消息视图，用户可切回已完成的数据集。成功无列回执默认进入摘要。
