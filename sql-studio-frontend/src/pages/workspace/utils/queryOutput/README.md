# 查询与对象输出

[源码](index.ts)

statementOutputs(run: RunState) 返回本批 StatementRun[]；优先使用 statements，当前对象结果使用单条且 SQL 为空，没有输出时返回空数组。statementDuration(item) 返回后端结果耗时，失败时使用前端记录的请求耗时；对象结果未记录耗时返回 undefined，不伪造为 0。不读写状态或访问数据库。

`resultOutputs(run)` 返回各个数据集所属的语句和导航位置 `{item,index,key}`，包括零行 SELECT、RETURNING 和 CALL/EXECUTE 的后续数据集。首个数据集继续使用原语句索引作为 key，后续数据集使用 `语句索引:数据集索引`。`executionCancelled(item)` 支持取消标记和旧记录的取消文案。`defaultOutputView(run,index,running,resultSetIndex=0)` 让失败和取消落在消息视图，用户可切回已完成的数据集。成功无列回执默认进入摘要。

`statementErrorDetail(item)` 返回语句失败原因，兼容已关联 SQL 的旧结果。`batchRequestError(run)` 返回未包含在逐条回执中的批次失败原因，供消息和摘要共用。`pageExecutionError(run)` 将查询的请求级错误交给顶部，保留对象加载错误提示。
