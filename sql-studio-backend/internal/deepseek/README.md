# DeepSeek 官方客户端

New() 返回共享客户端。Generate(ctx,key,modelID,messages,maxTokens) 使用官方 https://api.deepseek.com/chat/completions，空模型兼容旧配置回落 DefaultModel=deepseek-flash；已选 Pro/Flash ID 原样传递。thinking disabled、JSON输出、温度0.2。Models(ctx,key) 调用官方 GET https://api.deepseek.com/models，返回 model.AIModel 的真实id/name，不使用固定列表。

32秒网络超时继承ctx，不跟随重定向。响应最多256KiB，生成结果只接受finish_reason=stop。列表校验非空、重复ID、数量和长度。错误不透传上游响应正文或凭据，无模型列表或Key缓存。参考 https://api-docs.deepseek.com/api/list-models/ 和 https://api-docs.deepseek.com/api/create-chat-completion/ 。

- [agent](agent/README.md)：Agent官方思考SSE、工具调用与摘要，消费共享AI配置。
