# 聊天API

create(signal) 空对象创建持久会话，list(signal?) 读取轻量历史索引，view(id,signal) 读取已保存事件，remove(id) 调用删除 API。JSON 和 SSE 请求都使用全局 request 工具处理网络和 HTTP 错误。chat 通过 POST 消费 text/event-stream，每个 data JSON 由 decodeEvent 运行时校验。支持 UTF8 分片、SSE 多行 data、注释和心跳，收到 done 才结束。

reasoning_delta和answer_delta分开，模型usage与保守预算也有事件；最终answer用于校验合并，前端不得重复追加。reader在finally释放，AbortSignal向下游取消。无浏览器持久化或自动重试。旧后端拒绝ensure时明确提示重启Go后端，不降级创建、不绕过严格JSON校验。

create(signal?,ensure=false)立即创建并保存会话；ensureHistory(signal?)先读取索引，为空时使用POST {ensure:true}由后端原子保证默认会话，再读取索引。rename(id,title)调用PATCH并校验返回的索引信息。索引解码保留可选布尔字段 customTitle，标题翻译由页面按当前语言处理。创建和重命名只保存会话记录。

view仅读取指定会话的完整事件，不预取其他会话；每256个事件分批decodeEvent并让出主线程，批次之间及返回前检查signal。请求与事件校验均可取消，不返回半份结果。服务端按最多256事件及约256KiB分页（单条较大事件独占一页），通过nextOffset和revision/eventVersion继续；校验版本与游标，禁止循环、跳页和混合修改中的历史。兼容旧后端的无分页响应。

sessionBusy(id, signal) 仅读取首个响应的忙碌标志，用于停止后等待当前轮次保存，不继续读取或还原历史页。
