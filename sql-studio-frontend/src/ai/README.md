# AI 服务商入口

getAIAdapter(provider?) 返回 AIAdapter，默认当前首个服务商。aiProviders 导出只读 profile 列表，isAIProvider 校验外部服务商值。注册表通过 Record<AIProviderType, AIAdapter> 约束；只组装实际实现，不放品牌、模型或协议细节。

- [契约](typings/README.md)
- [DeepSeek](deepseek/README.md)

页面和 hooks 从统一入口获取 profile/listModels/assist；新增服务商按同一契约注册，不预建空实现。通用 HTTP 请求位于 services/ai。
