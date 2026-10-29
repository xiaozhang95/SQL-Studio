# 数据库、Schema 与表转储

useDataExport(canExport) 接收必填的 `(connectionId: string, database: string) => boolean`，由工作区按目标连接状态及数据库关闭状态判断是否可导出。发起前复核，未连接或数据库已关闭时直接返回，不打开弹框、文件选择器或发送请求。返回 state/busy/start(connection,database,withData,table?,schema?)/cancel()/close()。目标连接与范围在开始时固定，单个工作区同时一个导出，独立 AbortController，不创建页面或修改查询结果；卸载取消。先通过引擎 dumpFile 生成库/Schema 与表结构，再用专用 SSE 顺序读取各表，依次写入数据、序列状态、外键及视图。视图仅导出结构。进度按对象阶段估算，记录数和字节为实际值，日志最多150条。失败/取消中止文件，只有全部成功才保存。

支持仅结构和结构加数据。MySQL 保留库默认字符集及排序规则，文件内保存恢复外键检查/SQL mode；PostgreSQL 保留 Schema、基础表自有序列、identity 和延后外键，不支持的分区数据、外部或不可读序列明确失败。例程、触发器、事件、授权及外部依赖不在范围内；跨表不是全库一致性快照，弹窗和文件均说明。关闭导出所属库/连接会取消导出，其他范围继续。大库优先原生文件流，下载兼容模式的缓存限制见 exportWriter。

所有结构收集后，每个对象数据完成会重新读取 DDL 并检查变化；变化会停止并中止文件，MySQL 只忽略已有同结构判定允许的 AUTO_INCREMENT 计数变化。数据列集合与元数据不一致明确失败，避免结构变更或不可见列导致静默丢失。
