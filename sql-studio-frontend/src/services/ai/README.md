# SQL AI 请求

assistSQL(input: AIRequest, signal: AbortSignal): Promise<AIResult> 调用 POST /api/ai/assist，校验模型响应文本类型。网络或业务错误抛出，由调用 hook 展示；signal 贯穿后端模型请求。无缓存，不自动执行返回 SQL。

listAIModels(provider: AIProviderType, apiKey: string, signal: AbortSignal): Promise<AIModel[]> 调用 POST /api/ai/models，运行时校验 id/name。apiKey为空则后端复用已保存值；响应不含Key。由服务商适配器调用，共享服务不硬编码品牌或模型。
