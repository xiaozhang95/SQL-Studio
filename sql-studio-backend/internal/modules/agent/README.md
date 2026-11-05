# Chat业务模块

New(Generator,Database,Repository?)装配服务；生产注入本地仓库，未注入仅供替身测试使用内存。Create(ctx)创建无目标会话并保存；List/View按需加载历史；Delete仅显式删除空闲会话；Chat执行一轮。最多缓存32会话，淘汰缓存不删除磁盘记录，不再按闲置30分钟销毁历史。

Database由app注入Agent专属引擎客户端，与工作台隔离连接开关及取消状态；仅复用已保存配置和进程查询并发预算。会话的目标/发现记录不持有物理连接，每次数据库操作结束即释放，等待模型与写入确认期间不保留连接。

context.go使用1M窗口和700000保守输入上界，JSON字节数加模板余量作为token保守估算，不是假装精确tokenizer。给16384输出和后续工具预留空间，真实usage另行记录。超预算时通过非思考摘要请求逐批压缩较早完整用户轮次，最多8批/次，保留最近两轮完整工具与reasoning_content。摘要长度最多32KiB，失败不更新工作摘要；完整原文始终单独保存。近期单轮过大无法安全压缩则明确失败，不截断工具配对。

生产Generator支持GenerateStream，模型前发model_start，再转reasoning_delta/answer_delta/usage；工具片段完整验证后才执行。后续模型消息保留reasoning_content。不限制主要模型调用轮数和工具操作次数，每轮180秒；摘要调用计入总超时，独立最多8次每次prepare。元数据/只读规则沿用原约束。

输入最多 256 KiB，超过 64 KiB 等待继续确认。工具结果超过 32 KiB 时先保留原结果，确认后才送模。可压缩的上下文每轮确认一次。`list_databases` 读取失败时返回连接警告并继续处理同批工具，本轮再次探测该连接时复用警告。其他工具失败作为警告送回模型，同批剩余工具标记为未执行。模型可在已确认范围内重新规划一次只读操作。写入失败或恢复阶段再次失败时，仅请求模型总结。用户取消、确认超时和会话处理错误仍结束本轮。

persistence.go保存完整事件和成功模型历史。用户消息先保存、工具结果立即保存、流式片段约每秒检查点、结束最终保存。失败/取消保留事件和部分内容、标记未完成，不提交当轮模型历史/目标。重启读取到running标记interrupted，不重放SQL。最终保存失败返回错误而非done成功。

Create立即建立并索引“新建会话”；Ensure在服务互斥锁内检查索引，为空时创建，否则返回已有ID，处理多窗口/StrictMode重复请求。Rename(ctx,id,title)限1–80字符、trim且拒绝控制字符，执行中拒绝；更新失败还原缓存，成功持久化CustomTitle，手动名即使与默认名相同也不被首条消息覆盖。

Agent操作模式：POST /api/agent/chat 增加mode（readonly默认，write为完全访问模式，允许非删除数据及结构操作）。任何模式拒绝DELETE/DROP/TRUNCATE/REPLACE及删除性结构操作；删除仅提供命令及风险提示，不自动执行。刷新和往返工作台恢复上次确认的模式。支持单条INSERT/UPDATE/CREATE/ALTER/COMMENT及表达式和子查询；多语句、存储程序、动态SQL不执行，以防绕过删除限制；取消不保证回滚。查询回答提示生成真实二维JSON表格，前端校验后展示，支持导出当前已加载结果xlsx，截断明确提示。


写入逐次确认：execute_write通过write_confirmation SSE事件暂停，携带approvalId/connection/database/objects/sql。POST /api/agent/write-confirmation提交allow，确认ID不可重复使用；未确认、取消、超时、断开不执行，取消结束本轮。服务端生成明细并绑定本次目标/SQL，不接收前端替换SQL。确认独立等待最多5分钟，等待期间暂停本轮执行计时；恢复历史不重新显示已过期确认卡片。模式提示不替代逐次确认。

Agent SQL防线：sqlpolicy.go在工具层及app进程适配层校验单语句、读取类型、普通表达式函数及目标范围；禁止USE/会话设置、锁/等待、文件操作、未知存储/UDF函数、删除性函数及管理账户/扩展/服务器配置。MySQL/MariaDB限定当前数据库，PostgreSQL保留当前物理库内schema限定名，跨库函数不允许。完全访问仍支持非删除DDL、表达式/子查询及PostgreSQL ON CONFLICT DO UPDATE/NOTHING。确认对象由同一词法扫描提取全部源/目标对象，不再仅正则提取首个名称。

此检查是保守的受支持SQL子集，不是完整SQL解析器或数据库权限沙箱；未知函数应改写或由用户自行审阅执行。既有触发器、外键级联、函数重载、运算符、视图规则、FDW与数据库权限配置仍可能影响实际行为，生产环境需使用最小权限并审查这些配置；不宣称静态规则能阻止所有数据库内间接副作用。普通SQL工作区继续沿用原有能力。
