# PostgreSQL

[统一入口](../README.md) · [源码](index.ts)

按 DatabaseAdapter 组装 PostgreSQL 协议实现，可连接阿里云 PolarDB PostgreSQL 版和普通 PostgreSQL；不代表 PolarDB Oracle 兼容版。所有网络仍经共享 services/database，后端持有密码。

- [配置](profile/README.md)：type、默认端口、维护库及图标。
- [脚本与历史](statements/README.md)：美元引号、E 字符串和嵌套注释。
- [查询](query/README.md)：schema/table 身份与结构导出。
- [补全](completion/README.md)：当前数据库的 schema 范围。
- [数据编辑](dataEditing/README.md)：完整主键 UPDATE 与 INSERT。

objects=undefined 明确表示尚无可视化库表设计/管理与结构数据联合转储；通用 UI 隐藏这些入口，执行边界也拒绝，不能回退调用 MySQL SQL。保留查询、表/视图浏览、字段、索引、DDL 结构参考和数据行编辑。exportDDL 独立于可视化对象管理。useDatabase 返回 undefined，PostgreSQL 使用连接目标切库，不模拟 USE。每条请求独立会话，事务、SET、临时表不跨语句继承。

对象树按数据库 → schema → 表/视图分类 → 对象名展示；schema 使用真实列表，包含空 schema，表标签只显示本层名，目标仍为完整 schema/table。

查询页增加独立 schema 选择，当前 schema 传给后端执行、补全与 AI 上下文。数据库/schema 结构结果拆开列，对象页标题保留 schema 以区分同名表。[AI 引用](context/README.md) 保留完整对象身份。
