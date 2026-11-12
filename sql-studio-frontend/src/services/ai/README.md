# SQL AI 请求

assistSQL(input: AIRequest,signal): Promise<AIResult> 调用 POST /api/ai/assist，校验响应文本类型；调用使用后端明确选中的配置，未选择时拒绝，不补默认模型。网络/业务错误抛给调用 hook，signal 贯穿模型请求；无缓存，不自动执行 SQL。

listAIModels(provider,apiKey,signal,configId?): Promise<AIModel[]> 调用 POST /api/ai/models，校验非空 id/name。新 Key 仅用于本次连接测试；空 Key 时按 configId 复用对应行的后端 Key，空 Key 未提供 configId 时拒绝，不复用当前使用项。未知 ID 拒绝，不串用其他行 Key；响应不含密钥，由供应商适配器调用。
