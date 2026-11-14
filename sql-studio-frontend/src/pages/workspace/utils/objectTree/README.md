# 对象树标识和说明

`objectNodeKey(...parts: string[]): string` 将节点类型、连接、库、表和对象名编码为 JSON 元组，不假设名称中没有分隔符。

`indexDescription(index: DBIndex): string` 生成索引悬停说明，包含主键/唯一性、索引类型及按 position 排列的字段；保留前缀长度、降序，字段名为空时标记“表达式”，不推测表达式文本。不修改输入数组，无请求或缓存。`foreignKeyDescription(key: DBForeignKey): string` 按定义顺序展示本地列与引用表列及 ON UPDATE、ON DELETE。

索引 primary? 显式标志优先于历史 PRIMARY 名称判断，兼容 PostgreSQL 实际主键索引名；表达式字段可直接包含定义文本。
