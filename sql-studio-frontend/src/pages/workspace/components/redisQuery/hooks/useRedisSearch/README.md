# Redis 自动筛选

`useRedisSearch(filter,appliedPattern,enabled,onSearch)` 供键浏览和活跃频道共用。输入停顿 250ms 后把当前文本传给 `onSearch`，清空时提交空字符串。调用方在请求前将普通关键词转换为 Redis 子串匹配模式。只在启用且输入有变化时安排筛选。切换工具、写入期间及卸载时取消待触发计时，恢复后处理仍未应用的输入。各调用方管理请求与取消逻辑。
