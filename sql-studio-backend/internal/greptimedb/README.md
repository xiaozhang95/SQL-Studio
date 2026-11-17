# GreptimeDB 引擎

`NewClient()` 通过 MySQL 线协议测试连接、管理本客户端会话、读取库表、列、索引与 DDL，以及执行 SQL。缺省连接库为 `public`，显式请求的数据库优先。对象范围只有数据库和表两层。连接可使用 GreptimeDB 已配置的用户名与密码，也可连接未启用鉴权的实例。

底层复用 MySQL 连接生命周期、取消和有界结果读取。每个 API 请求独立打开连接。执行前核对单语句边界，默认只接受读语句及 USE。完整的双引号 `USE` 在发送时转换为 MySQL 线协议接受的反引号写法。写入由调用方显式启用。工作台多语句按顺序单独请求，取消不会回滚已完成的写入。

表字段保留 `TIME INDEX`。目录缺少视图字段时，`Columns` 通过 `SELECT * FROM <view> LIMIT 0` 按定义顺序返回列名和协议类型，未知的可空性及其他目录属性留空。视图 DDL 使用 `SHOW CREATE VIEW`。支持 `TQL` 行结果。流式 SQL 转储与匹配行计数尚未接入。

数据库同步支持普通 Mito 表，沿用 SHOW CREATE TABLE 的 TIME INDEX、主键和表选项。数据按表逐批复制，源端并发写入期间没有全库快照。跳过视图，Metric 表不在范围内。

Monitor 读取所选库 information_schema.tables/region_statistics 的主分片统计，汇总表、分片、估算行数、磁盘/缓冲及 SST 文件。可选 BUILD_INFO 返回实际构建版本，可选扩展列返回 SST/索引/元数据大小及分片打开以来的写入/扫描/CPU 累计值。扩展不存在或无权限时保留基础指标并返回 details.warnings，取消遵守统一元数据期限。无表时基础汇总为 0；有表但对应统计为 NULL 时保持未知。区域统计为估算，重新打开/迁移会改变累计基线，不将其伪造为稳定的全局 QPS/网络速率。
