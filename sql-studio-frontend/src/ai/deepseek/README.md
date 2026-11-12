# DeepSeek 适配器

默认导出满足 AIAdapter 的实现，组合 [profile](profile/README.md)、[api](api/README.md)。模型来自官方 GET /models，不维护固定 Pro/Flash 选项表；不提供旧配置回退。品牌 SVG 放 [assets](assets/README.md)。外部通过 getAIAdapter 调用，不在通用 UI 写入 DeepSeek 品牌或默认模型。
