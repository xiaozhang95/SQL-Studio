# 当前查询连接与数据库选择器

[组件索引](../README.md) · [源码](index.tsx)

scope 为 QueryScope；connections 为已保存连接；objects 为 useDatabaseObjects 返回值；disabled；onConnection(id)、onSelect(database, table?)。

工具栏仅展示连接、数据库，不提供表下拉；表选择和表操作统一由左侧树负责。连接选项只包含结构加载成功的连接，使用品牌图标和名称。切连接清空旧库表，切库清空表；树和下拉修改当前查询同一份范围，各标签独立保存。

库列表使用对应连接已加载的元数据；库表列表由树箭头或双击节点按需加载，共用缓存。关闭时清空相关查询的连接/库/表选择，SQL 草稿保留；重新连接成功后仍需重新选择。长连接名省略，悬停可查看完整值。
