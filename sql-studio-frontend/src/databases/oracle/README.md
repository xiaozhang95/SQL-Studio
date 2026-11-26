# Oracle 适配器

[数据库适配器索引](../README.md) · [用户说明](../../../../docs/DATABASES.md#oracle)

- [连接资料](profile/README.md)定义端口、服务名、图标和表单说明。
- [对象身份与查询](query/README.md)、[PL/SQL 补全](completion/README.md)和[脚本切分](statements/README.md)供对象树和工作台使用。
- [对象操作](objectManagement/README.md)、[表设计](tableDesign/README.md)、[数据编辑](dataEditing/README.md)及[转储](dataDump/README.md)生成 Oracle SQL。
- [监控面板](monitor/README.md)组合 Oracle 指标与共用趋势图。

`oracle` 导出 `DatabaseAdapter`。工作区批次使用同一会话，表设计提交多条 DDL 时沿用批次接口。同步页以 Schema 为源和目标，登录连接仍使用服务名。
