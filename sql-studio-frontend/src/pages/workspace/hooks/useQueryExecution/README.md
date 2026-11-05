# SQL 批次执行

useQueryExecution(options) 返回 executeSQL(sql,scope,tabId,kind='query')。createQueryExecutor 为同一编排工厂，便于隔离请求验证。输入包含连接、元数据快照、界面锁、请求 ref、运行/结果/历史回调和目标页面更新器。批次固定发起页、连接、初始库和取消信号，按引擎切分并顺序执行；失败或取消立即停止，释放运行锁，保留已完成结果。成功 USE 仅更新发起页及后续请求默认库。只在 kind=query 时追加历史；data 预览保持默认只读请求。SQL 窗口继续显式 allowWrite=true，刷新可重新执行 DDL/DML。结果即时更新内存，由持久化层在批次结束后保存一次。
