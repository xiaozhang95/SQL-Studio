# 执行历史规则

historyLimit=50，按连接保存最新记录。normalizeHistories(stored,cleanSQL) 校验连接归属、截取最新 50 条并清理来源注释；不改变新到旧顺序，格式错误抛出异常。

retainConnectionHistories(histories,connectionIds) 只保留仍存在连接的历史，无变化返回原对象；仅在连接列表成功加载、历史恢复完成后调用。纯方法不读写文件、不执行 SQL。
