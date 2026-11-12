# DeepSeek 接口入口

deepseekAPI 实现 AIAdapter.listModels/assist。listModels(apiKey,signal,configId?) 经本机 POST /api/ai/models 获取官方列表。新 Key 仅用于本次连接测试，空 Key 必须按 configId 精确复用对应记录的 Key。发现结果由用户选中后保存。assist 使用后端解析的共享默认模型。错误原样抛出，支持取消，无全局缓存。
