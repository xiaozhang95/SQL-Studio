# model

共享契约：`Target` 固定连接/数据库；`Connection` 仅含 id/name/type；`Message`/`ToolCall`/`Tool` 对应 DeepSeek 工具协议；`Event` 对应 SSE JSON数据。结构化数据库结果使用 json.RawMessage 保留原始精确数字文本，不转 float。类型不含持久化、环境或执行逻辑。

workspace.go定义会话模型历史/事件/摘要、轻量索引和布局修订号；settings.go集中DeepSeek Flash/Pro支持列表。model仅描述契约，不执行存储/HTTP/模型调用。

Conversation.CustomTitle记录显式重命名，用于阻止首条用户消息覆盖手动名称；不包含在轻量索引中。

Event.createdAt为可选RFC3339时间，user事件由服务端写入UTC发送时间并随会话保存。旧事件允许缺失。

write_confirmation的objects包含本条SQL的目标及源对象名，保留标识符引号并去重；用户可在回复下方卡片核对全部对象与完整SQL，历史确认ID不可重新提交。

limits.go共享消息与工具结果的字节阈值和可恢复错误标识。继续确认使用 `continue_confirmation`，拒绝继续使用 `stopped`，与写入确认事件分开。

包名 agentmodel，与普通model契约区分。ConversationView增加可选NextOffset及EventVersion，支持有界分页和恢复一致性；SummaryMaxRunes=2000与SummaryMaxTokens=4096由压缩校验和模型请求共享。
