# 对象展示兼容

presentTableList(result,adapter,schema?) 将旧 PostgreSQL 数据库结构结果中的完整表标识转成独立 Schema/表名列，保留非结构结果、已拆列结果和无法解析的原始输出。不会访问网络或自动重跑 SQL。

presentObjectPage(page,adapter) 为 PostgreSQL 对象页生成带 schema 的可读标题，并从旧表身份补全缺省 schema；原 table、连接、库和 SQL 不改写，查询页自定义标题保留，明确清空的 schema 不被覆盖。MySQL 原样返回。
