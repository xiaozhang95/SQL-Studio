# 查询与对象输出

[源码](index.ts)

statementOutputs(run: RunState) 返回本批 StatementRun[]；优先使用 statements，当前对象结果使用单条且 SQL 为空，没有输出时返回空数组。statementDuration(item) 返回后端结果耗时，失败时使用前端记录的请求耗时；对象结果未记录耗时返回 undefined，不伪造为 0。不读写状态或访问数据库。

resultOutputs(run) 只返回包含数据列的结果及原始语句索引 {item,index}；SELECT 零行和 RETURNING 仍保留，成功无列回执和错误只进入消息/摘要。defaultOutputView(run,index,running) 返回默认导航 key：当前错误或执行中无数据为 messages，所选数据集使用原始索引字符串，其余已完成回执为 summary。完整记录不被过滤或重排，刷新、历史和恢复仍使用原索引。
