# 当前查询连接与数据库选择器

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[组件索引](../README.md) · [源码](index.tsx)

scope 为 QueryScope；connections 为已保存连接；objects 为 useDatabaseObjects 返回值；disabled；onConnection(id)、onSelect(database, table?)。

工具栏展示连接和数据库，Oracle 将数据库项显示为服务。PostgreSQL 和 Oracle 另外提供 Schema。表操作在左侧对象树发起并携带显式目标。连接选项包含已保存的各种引擎，使用品牌图标和名称。选择尚未打开的连接时加载其元数据，切连接清空旧库表和旧结果，切库清空表；下拉仅修改当前查询范围，各标签独立保存；树的单击/双击和高亮不与下拉联动，下拉切换也不改变树高亮。

库列表使用对应连接的元数据。恢复工作区时，活动查询页绑定的连接会加载库列表；加载期间显示等待状态，成功后可选择数据库或服务。对象树按自身展开记录加载子项，并共用缓存。长连接名省略，悬停可查看完整值。

连接选项使用带圆角底板的官方品牌图标，并按对象快照在品牌原色与灰底白图标之间切换。数据库选项显式展示 DatabaseOutlined，已选值不重复渲染 prefix 图标。数据库搜索改按纯文本 searchText 匹配，避免 JSX label 影响搜索。

连接状态图标为 18px，选择器高度跟随 30px 的主题控件高度。连接、数据库、Schema 选择器空间充足时均为 240px，SQL 与 Redis 共用同一尺寸。选择器在一行内等宽收缩，容不下其最小宽度时换行。

PostgreSQL 和 Oracle 的 Schema 选项来自当前连接和数据库或服务已加载的 schemas。`onSchema(schema)` 独立回调。切换 Schema 清空表范围，切换库或连接清空 Schema。清空时 PostgreSQL 使用默认搜索路径，Oracle 使用登录用户的 Schema。

Redis 复用连接和数据库下拉框。同一查询页可在 Redis 与 SQL 连接之间切换。逻辑库选项来自对应连接已加载的列表，配置的默认库可用时优先使用。
