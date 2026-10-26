# DeepSeek 接口入口

deepseekAPI 实现 AIAdapter.listModels/assist。listModels(apiKey,signal) 经本机 POST /api/ai/models 获取官方可用模型；Key 为空时后端使用已保存值，新 Key 仅用于本次发现请求。assist 复用通用后端 SQL AI 请求，实际模型由后端配置决定。两者错误原样抛出，支持取消，无全局缓存。
