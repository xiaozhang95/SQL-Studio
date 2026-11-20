# SQL 批次执行

切分 SQL 失败时调用 `options.message.error`。工作区将切分和执行错误统一显示在顶栏下方，消息及摘要保留各语句状态和已完成结果。主动取消用 `cancelled` 表示，消息、摘要与执行历史显示「执行已取消」；同会话批次保留已收到的回执。逐条成功状态和影响行数发布到当前批次的结果、消息及摘要。纯注释或空白内容仅提示无需执行；MySQL/MariaDB 行首无空白的 `--CREATE` 等注释由引擎切分器规范化，保留行中减法及字符串原义。

useQueryExecution(options) 返回 executeSQL(sql,scope,tabId,kind='query',singleStatement=false)。createQueryExecutor 为同一编排工厂，便于隔离请求验证。批次固定发起页、连接、初始库、Schema 和取消信号。MySQL、MariaDB 和 PostgreSQL 多语句通过批次 API 共享物理连接。MySQL 和 MariaDB 可显式发送完整单语句，结果记录语句边界供重新执行。语句失败停止后续执行，取消或断流保留已收到的回执。成功 USE 仅更新发起页及后续语句默认库。只在 kind=query 时追加历史；data 预览保持默认只读。SQL 窗口显式允许写入，刷新可重新执行 DDL/DML。结果即时更新内存，由持久化层在批次结束后保存。

Redis 命令编辑器按行执行，通过命令接口返回共享的查询结果结构。批次成功切库时，后续命令和发起页都使用新逻辑库。历史按连接分别保存，执行失败或取消后停止后续命令。
