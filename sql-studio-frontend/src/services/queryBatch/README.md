# MySQL／MariaDB 批次请求

`executeQueryBatch(id, database, statements, signal, onStep)` 显式提交 SQL 工作台已切分的语句，使用同一数据库会话。逐行读取并验证结果顺序，每条执行回执或错误调用一次 `onStep`。成功的 USE 事件可返回新库名。收到完整 `done` 后结束，网络、协议错误或取消会拒绝 Promise 并释放响应流。
