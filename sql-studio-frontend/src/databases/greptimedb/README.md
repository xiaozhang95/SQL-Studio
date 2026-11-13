# GreptimeDB 适配器

默认导出 `DatabaseAdapter`，引擎身份为 `greptimedb`。连接表单默认使用 MySQL 线协议端口 4002 和维护库 `public`。未启用鉴权时用户名和密码可留空。

引擎使用 [GreptimeDB 官方 SVG](../../assets/databases/greptimedb.svg)，通过共享 EngineIcon 显示为白色图形，圆角底板表示连接状态。

复用反引号标识符、表预览和对象补全，使用 GreptimeDB 的注释及字符串规则切分脚本。成功执行 `USE` 后，后续语句沿用查询页的新库范围。表、字段、索引及 DDL 来自后端，DDL 保留原始 GreptimeDB 定义。数据预览支持 CSV，建表和写入从 SQL 编辑器执行。
