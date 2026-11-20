# SQL 同会话批次请求

`executeQueryBatch(id, database, statements, signal, onStep, schema?)` 显式提交工作台的 MySQL、MariaDB 或 PostgreSQL 语句，使用同一会话。PostgreSQL 的可选 `schema` 指定初始搜索路径。逐行验证结果顺序，每条回执调用一次 `onStep`，已识别的语句错误携带 `statementError: true`。MySQL 和 MariaDB 的 USE 回执可返回新库名。收到完整 `done` 后结束，批次错误、网络或协议错误、取消均会释放响应流并拒绝 Promise。
