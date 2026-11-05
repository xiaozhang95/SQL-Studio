# 聊天API

create(signal)空对象创建持久会话；list(signal?)读取轻量历史索引；view(id,signal)读取已保存事件；remove(id)显式删除API。chat通过POST fetch消费text/event-stream，每个data JSON由decodeEvent运行时校验。支持UTF8分片与SSE多行data、注释和心跳，必须有done，否则抛未完成错误。error事件不是成功。

reasoning_delta和answer_delta分开，模型usage与保守预算也有事件；最终answer用于校验合并，前端不得重复追加。reader在finally释放，AbortSignal向下游取消。无浏览器持久化或自动重试。旧后端拒绝ensure时明确提示重启Go后端，不降级创建、不绕过严格JSON校验。

create(signal?,ensure=false)立即创建并保存会话；ensureHistory(signal?)先读取索引，为空时使用POST {ensure:true}由后端原子保证默认会话，再读取索引。rename(id,title)调用PATCH并校验返回的索引信息。创建/重命名不调用模型或数据库。

view仅读取指定会话的完整事件，不预取其他会话；每256个事件分批decodeEvent并让出主线程，批次之间及返回前检查signal。请求与事件校验均可取消，不返回半份结果。服务端按最多256事件及约256KiB分页（单条较大事件独占一页），通过nextOffset和revision/eventVersion继续；校验版本与游标，禁止循环、跳页和混合修改中的历史。兼容旧后端的无分页响应。
