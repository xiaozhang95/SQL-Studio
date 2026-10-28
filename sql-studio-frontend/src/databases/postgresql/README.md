# PostgreSQL

[统一入口](../README.md) · [源码](index.ts)

按 DatabaseAdapter 组装 PostgreSQL 协议实现，可连接阿里云 PolarDB PostgreSQL 版和普通 PostgreSQL；不代表 PolarDB Oracle 兼容版。所有网络仍经共享 services/database，后端持有密码。

- [配置](profile/README.md)：type、默认端口、维护库及图标。
- [脚本与历史](statements/README.md)：美元引号、E 字符串和嵌套注释。
- [查询](query/README.md)：schema/table 身份与结构导出。
- [补全](completion/README.md)：当前数据库的 schema 范围。
- [数据编辑](dataEditing/README.md)：完整主键 UPDATE 与 INSERT。
- [数据库属性](databaseProperties/README.md)：读取并编辑所有者、连接数上限和注释。
- [结构和数据](dataDump/README.md)：单表精确值导出、SERIAL/IDENTITY 序列恢复。

objects=undefined 表示不使用 MySQL 的库表一体能力；databaseEditor 独立提供库属性读取与编辑，dataDump 提供单表结构和数据转储。simpleObjects 提供建库、删库、Schema 操作、删表或视图、清空表与重命名；tableDesign 提供新建表及字段增删改，边界见 [表设计](tableDesign/README.md)。均不回退 MySQL SQL。exportDDL 独立支持结构参考导出，完整备份使用 pg_dump。useDatabase 返回 undefined，PostgreSQL 使用连接目标切库；每条请求独立会话，事务、SET、临时表不跨语句继承。

对象树按数据库 → schema → 表/视图分类 → 对象名展示；schema 使用真实列表，包含空 schema，表标签只显示本层名，目标仍为完整 schema/table。

查询页增加独立 schema 选择，当前 schema 传给后端执行、补全与 AI 上下文。数据库/schema 结构结果拆开列，对象页标题保留 schema 以区分同名表。[AI 引用](context/README.md) 保留完整对象身份。

dumpFile 封装数据库/Schema 结构头、序列和延后外键；流式 prepareDump/dumpRows 见 dataDump。
