# 输出记录兼容

[源码](index.ts)

statementOutputs(run: RunState) 返回本批 StatementRun[]；优先使用 statements，旧快照和对象结果退回单条且 SQL 为空，没有输出时返回空数组。statementDuration(item) 返回后端结果耗时，失败时使用前端记录的请求耗时；旧记录缺少耗时返回 undefined，不伪造为 0。不读写状态或访问数据库。
