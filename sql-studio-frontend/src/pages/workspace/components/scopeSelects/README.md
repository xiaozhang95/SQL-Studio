# 当前查询连接与数据库选择器

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[组件索引](../README.md) · [源码](index.tsx)

scope 为 QueryScope；connections 为已保存连接；objects 为 useDatabaseObjects 返回值；disabled；onConnection(id)、onSelect(database, table?)。

工具栏展示连接、数据库；PostgreSQL 另外提供 Schema，不提供表下拉；左侧表操作始终携带显式目标。连接选项只包含结构加载成功的连接，使用品牌图标和名称。切连接清空旧库表，切库清空表；下拉仅修改当前查询范围，各标签独立保存；树的单击/双击和高亮不与下拉联动，下拉切换也不改变树高亮。

库列表使用对应连接已加载的元数据；库表列表由树箭头或双击节点按需加载，共用缓存。关闭时清空相关查询的连接/库/表选择，SQL 草稿保留；重新连接成功后仍需重新选择。长连接名省略，悬停可查看完整值。

连接选项使用所属引擎品牌图标及独立状态圆点；数据库选项显式展示 DatabaseOutlined，已选值不重复渲染 prefix 图标。数据库搜索改按纯文本 searchText 匹配，避免 JSX label 影响搜索。

连接状态图标为 20px，保持原生默认选择器 32px 高度；标准宽度上限为 220px，与结果选择器一致，窄屏继续按工具栏可用空间收缩。

PostgreSQL 显示第三个 Schema 选择器，选项来自当前连接/数据库已加载的 schemas。onSchema(schema) 独立回调；选择/清空 schema 清空表范围，切库/连接清空 schema；未选择使用默认搜索路径。MySQL 仍仅连接/数据库两项。
