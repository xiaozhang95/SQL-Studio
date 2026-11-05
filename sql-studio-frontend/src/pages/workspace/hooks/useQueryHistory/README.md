# 执行历史

useQueryHistory(connectionId) 返回当前连接 history、appendHistory、clearHistory、pruneHistory、ready/saving/error。首次读取 Go history 分区，缺失初始化空历史；读取和追加都按每连接最多 50 条，保留新到旧顺序，清理来源注释。

clearHistory(id) 移除该连接记录；pruneHistory(connectionIds) 清理已不存在连接的历史，无变化保留对象身份。工作区在连接删除成功后立即清理对应历史，并在历史恢复及连接列表成功加载后清理遗留孤立记录；连接列表失败不清理。

恢复完成才允许执行，200ms防抖写入Go；同区请求串行，旧窗口CAS冲突不覆盖新数据。失败保留内存及旧文件并显示错误，不回落浏览器持久化。清空仅影响当前连接；记录实际发出的语句，取消不是回滚。最后200ms未提交变更在强制关闭时可能丢失。

当前缺失历史配置直接初始化空历史，不再读取浏览器旧历史。

恢复阶段只校验/截取历史，不用默认 MySQL 方言重写全部引擎 SQL；追加按 HistoryItem.databaseType 选择清理器，载入按目标查询页适配器处理，避免破坏 PostgreSQL 美元引号函数体。

返回 histories 供保存失败恢复副本使用。表数据浏览不调用 appendHistory，避免挤出用户编写的查询；SQL 窗口手动运行和重新执行仍记录历史。
