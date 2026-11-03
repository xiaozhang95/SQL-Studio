# 聊天API

create(signal)空对象创建持久会话；list(signal?)读取轻量历史索引；view(id,signal)读取已保存事件；remove(id)显式删除API。chat通过POST fetch消费text/event-stream，每个data JSON由decodeEvent运行时校验。支持UTF8分片与SSE多行data、注释和心跳，必须有done，否则抛未完成错误。error事件不是成功。

reasoning_delta和answer_delta分开，模型usage与保守预算也有事件；最终answer用于校验合并，前端不得重复追加。reader在finally释放，AbortSignal向下游取消。无浏览器持久化或自动重试。
