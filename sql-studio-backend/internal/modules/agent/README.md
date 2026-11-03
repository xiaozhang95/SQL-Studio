# Chat业务模块

New(Generator,Database,Repository?)装配服务；生产注入本地仓库，未注入仅供替身测试使用内存。Create(ctx)创建无目标会话并保存；List/View按需加载历史；Delete仅显式删除空闲会话；Chat执行一轮。最多缓存32会话，淘汰缓存不删除磁盘记录，不再按闲置30分钟销毁历史。

context.go使用1M窗口和700000保守输入上界，JSON字节数加模板余量作为token保守估算，不是假装精确tokenizer。给16384输出和后续工具预留空间，真实usage另行记录。超预算时通过非思考摘要请求逐批压缩较早完整用户轮次，最多8批/次，保留最近两轮完整工具与reasoning_content。摘要长度最多32KiB，失败不更新工作摘要；完整原文始终单独保存。近期单轮过大无法安全压缩则明确失败，不截断工具配对。

生产Generator支持GenerateStream，模型前发model_start，再转reasoning_delta/answer_delta/usage；工具片段完整验证后才执行。后续模型消息保留reasoning_content。不限制主要模型调用轮数和工具操作次数，每轮180秒；摘要调用计入总超时，独立最多8次每次prepare。元数据/只读规则沿用原约束。

persistence.go保存完整事件和成功模型历史。用户消息先保存、工具结果立即保存、流式片段约每秒检查点、结束最终保存。失败/取消保留事件和部分内容、标记未完成，不提交当轮模型历史/目标。重启读取到running标记interrupted，不重放SQL。最终保存失败返回错误而非done成功。

Create立即建立并索引“新建会话”；Ensure在服务互斥锁内检查索引，为空时创建，否则返回已有ID，处理多窗口/StrictMode重复请求。Rename(ctx,id,title)限1–80字符、trim且拒绝控制字符，执行中拒绝；更新失败还原缓存，成功持久化CustomTitle，手动名即使与默认名相同也不被首条消息覆盖。
