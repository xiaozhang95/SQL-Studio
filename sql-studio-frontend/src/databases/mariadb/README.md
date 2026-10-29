# MariaDB

[配置](profile/README.md) · [脚本](statements/README.md) · [补全](completion/README.md) · [对象管理](objectManagement/README.md)

入口按 DatabaseAdapter 组装 MariaDB 11.4 支持，连接类型独立为 mariadb。查询、表/视图/字段/索引浏览、数据编辑、库表管理及流式 SQL 转储显式复用 MySQL 兼容语法；不复制通用 HTTP、表单或状态。MariaSQL 提供关键字补全，脚本保留 MariaDB 可执行注释；默认值及排序规则差异在本目录处理。

导出保留结构、精确数值、二进制、生成列及自增规则；跨表不保证同一快照。仅表和视图纳入可视化对象，独立序列、例程、触发器、事件和授权不在转储范围；系统版本表的数据导出明确拒绝不完整历史，改用 mariadb-dump。SQL 窗口按原生 SQL 执行专属能力，不额外限制显式写入。
