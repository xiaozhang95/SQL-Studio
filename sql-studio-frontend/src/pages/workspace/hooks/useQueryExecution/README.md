# SQL 批次执行

切分 SQL 失败时调用 `options.message.error`。单句请求和批次回执的 statementError 标记随语句保存，消息及摘要展示相应失败原因，连接和批次请求失败由顶部提示展示。主动取消用 `cancelled` 表示，消息、摘要与执行历史显示「执行已取消」。同会话批次保留已收到的回执。逐条成功状态和影响行数发布到当前批次的结果、消息及摘要。纯注释或空白内容仅提示无需执行。MySQL/MariaDB 行首无空白的 `--CREATE` 等注释由引擎切分器规范化，保留行中减法及字符串原义。MySQL、MariaDB 和 PostgreSQL 的引擎切分器跟踪本次脚本内可确定的会话字符串转义设置。

useQueryExecution(options) 返回 executeSQL(sql,scope,tabId,kind='query',singleStatement=false)。createQueryExecutor 为同一编排工厂，便于隔离请求验证。批次固定发起页、连接、初始库、Schema 和取消信号。MySQL、MariaDB、PostgreSQL 和 Oracle 的多语句通过批次 API 共享物理连接。MySQL 和 MariaDB 可显式发送完整单语句，结果记录语句边界供重新执行。语句失败停止后续执行，取消或断流保留已收到的回执。成功 USE 仅更新发起页及后续语句默认库。`kind=query` 的 SQL 显式允许写入并传 `unlimitedRows: true`，逐条记录历史。重新执行可再次执行 DDL/DML。`kind=data` 使用方言对应的 1000 行只读预览。结果即时更新内存，由持久化层在批次结束后保存。

Redis 命令编辑器按行执行，通过命令接口返回共享的查询结果结构。批次成功切库时，后续命令和发起页都使用新逻辑库。历史按连接分别保存，执行失败或取消后停止后续命令。

单条执行、批次回执或批次流出现可能与连接有关的失败时，由 `objects.verifyConnection` 复核发起连接。语句错误、主动取消和请求体超限直接展示本次执行结果。复核在后台进行，保留本次执行回执与历史。
