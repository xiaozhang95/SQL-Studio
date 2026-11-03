# model

共享契约：`Target` 固定连接/数据库；`Connection` 仅含 id/name/type；`Message`/`ToolCall`/`Tool` 对应 DeepSeek 工具协议；`Event` 对应 SSE JSON数据。结构化数据库结果使用 json.RawMessage 保留原始精确数字文本，不转 float。类型不含持久化、环境或执行逻辑。

workspace.go定义会话模型历史/事件/摘要、轻量索引和布局修订号；settings.go集中DeepSeek Flash/Pro支持列表。model仅描述契约，不执行存储/HTTP/模型调用。
