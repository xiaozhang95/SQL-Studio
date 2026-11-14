# 数据库、Schema 与表转储

通过 useTranslation 读取发起操作时的语言，进度日志、取消与失败原因、保存位置及完成提示使用对应文案，并把语言传给 createExportWriter。表名、库名和生成的 SQL 保留原值；服务请求通过共享 request 携带当前语言，后端流式错误按请求语言返回。

useDataExport(canExport) 接收必填的 `(connectionId: string, database: string) => boolean`，由工作区按目标连接状态及数据库关闭状态判断是否可导出。发起前复核，未连接或数据库已关闭时直接返回，不打开弹框、文件选择器或发送请求。返回 state/busy/start(connection,database,withData,table?,schema?)/cancel()/close()。目标连接与范围在开始时固定，单个工作区同时一个导出，独立 AbortController，不创建页面或修改查询结果；卸载取消。先通过引擎 dumpFile 生成库/Schema 与表结构，再用专用 SSE 顺序读取各表，依次写入数据、序列状态、外键及视图。视图仅导出结构。进度按对象阶段估算，记录数和字节为实际值，日志最多150条。失败/取消中止文件，只有全部成功才保存。

支持仅结构和结构加数据。MySQL/MariaDB 保留库默认字符集及排序规则，文件内保存恢复外键检查/SQL mode，多个视图先创建占位再写入最终定义。PostgreSQL 保留 Schema、基础表自有序列、identity 和延后外键，按目录中的直接依赖写入视图，不支持的分区数据、外部或不可读序列明确失败。例程、触发器、事件、授权及外部依赖不在范围内；跨表不是全库一致性快照，弹窗和文件均说明。关闭导出所属库/连接会取消导出，其他范围继续。大库优先原生文件流，下载兼容模式的缓存限制见 exportWriter。

所有结构收集后，每个对象数据完成会重新读取 DDL 并检查变化；变化会停止并中止文件，MySQL 只忽略已有同结构判定允许的 AUTO_INCREMENT 计数变化。MySQL/MariaDB 显式读取不可见列并保留其值，生成列由目标端计算。数据列集合与元数据不一致时中止导出。

PostgreSQL 的库和 Schema 转储跳过系统目录标记为扩展成员的对象，并在进度日志报告数量。显式指定单表时沿用单表规则。依赖的扩展需要在目标库预先安装，扩展配置数据和运行历史请按扩展自身的备份方式处理。

canExport 回调同时检查连接与目标库是否成功打开，未加载表列表、加载中/失败或显式关闭均拒绝，选择文件之前及调用时统一门禁。

[orderDumpViews](orderDumpViews/README.md) 负责按转储范围内的视图依赖排序。
