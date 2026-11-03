# model

共享契约：`Target` 固定连接/数据库；`Connection` 仅含 id/name/type；`Message`/`ToolCall`/`Tool` 对应 DeepSeek 工具协议；`Event` 对应 SSE JSON数据。结构化数据库结果使用 json.RawMessage 保留原始精确数字文本，不转 float。类型不含持久化、环境或执行逻辑。

workspace.go定义会话模型历史/事件/摘要、轻量索引和布局修订号；settings.go集中DeepSeek Flash/Pro支持列表。model仅描述契约，不执行存储/HTTP/模型调用。

Conversation.CustomTitle记录显式重命名，用于阻止首条用户消息覆盖手动名称；不包含在轻量索引中。

Event.createdAt为可选RFC3339时间，user事件由服务端写入UTC发送时间并随会话保存。旧事件允许缺失。
