# Redis 编辑器命令

`redisCompletion` 在每行命令名位置提供常用命令和参数提示，支持补全快捷键和大小写匹配。`splitRedisLines` 按行生成命令，跳过空行及以 # 开头的注释，保留参数引号与转义。

`redisCommandHints` 返回命令前缀或已输入命令的使用格式，供终端静态展示。`formatRedisCommands` 统一每行命令名和命令后的分隔空白，保留参数及引号。
