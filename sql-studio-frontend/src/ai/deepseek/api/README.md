# DeepSeek 接口入口

deepseekAPI 实现 AIAdapter.listModels/assist。listModels(apiKey,signal,configId?) 经本机 POST /api/ai/models 获取官方列表；新 Key 仅用于本次连接测试，空 Key 必须按 configId 精确复用对应记录后端值，不提供旧协议回落。发现接口不选择模型，用户选择的 ID 原样使用。assist 使用后端明确选中的模型配置，没有选择时拒绝，不回落默认值。错误原样抛出，支持取消，无全局缓存。
