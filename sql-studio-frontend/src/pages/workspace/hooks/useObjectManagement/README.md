# 对象管理生命周期

[源码](index.ts) · [hooks 索引](../README.md)

useObjectManagement 接收 connections、blocked（普通查询运行锁）、onBusyChange 和异步 onChanged(change)；返回受控 form/dialog、加载/保存/就绪/错误、字符集选项、原字段、SQL 预览及 open/close/preview/save 等方法。open 显式接收 ObjectAction 和 ObjectTarget，不从活动 SQL 页面推断目标。

加载库表单时读取服务器实际排序规则及库默认值；表设计读取字段、完整 DDL 和 SQL mode。AbortController 绑定本次打开动作，取消/卸载拒绝迟到数据写入新表单；保存期间不关闭。字段校验通过后预览和保存共用同一引擎生成器。保存只有一次显式 allowWrite 的单语句请求，普通执行接口不被升级；危险动作要求完整对象名称。防重复提交，并检查验证期间取消的表单不会继续发送请求。

保存成功先关闭表单，再通过 onChanged 刷新缓存并修正查询范围；刷新失败明确提示操作已生效，不能误导重复写入。失败保留表单，断连时提示核对实际状态，取消不宣称回滚。元数据/写入/转储期间通过 onBusyChange 锁定工作区；连接配置快照和对象范围不随页面切换漂移。

可选 initial 提供页面首次打开操作，等待连接可用后初始化；keepOpen=true 用于表设计页，提交成功不销毁表单，刷新后重新打开 EditTable；onDirtyChange 回报用户修改及成功重载后的清理。dirty 标识只在本页存活，reload 重读当前对象。页面模式保存前比对原始 DDL，防止长时间停留后静默覆盖已改变结构；MySQL 忽略仅自增计数的变化。StrictMode 重放及卸载清理先释放旧请求引用，迟到请求不能覆盖新页。

库编辑优先使用独立 databaseEditor 能力，返回 databaseDefinition 并填充所属表单；PostgreSQL 的所有者/连接上限/注释在一个 DO 事务内修改，原值变化拒绝旧预览，失败保留输入。其余操作继续按 objects、tableDesign、simpleObjects 分派，禁止回退其他引擎。

数据转储按 engine.dataDump 读取目标表数据及可选元数据，再复查 DDL 未变化后生成文件。MySQL 复用原有实现，PostgreSQL 补充自有序列元数据、生成列和类型编码；无能力或被截断时不下载。只读读取使用 API 默认限制与取消，结果不进入 SQL 页、历史或工作区持久化；不保证并发写入下的事务快照。

转储失败使用 Ant Design 错误弹窗显示具体原因，避免工作区隐藏 message 浮层后超限/不支持等错误不可见；请求取消不弹错误。

结构和数据导出迁入 useDataExport，表单管理不再持有导出请求或普通查询截断数据。
