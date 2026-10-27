# AI 适配契约

AIProvider/AIProviderType 表示已实现服务商。AIAdapter 包含只读 profile（value/label/defaultModel/icon/darkIcon）、listModels(apiKey,signal) 与 assist(input,signal)。AIModel 的 id 是官方调用标识，name 是显示名；AIConfig/AIConfigDocument 对应后端脱敏配置，包含 model/completionEnabled/configured，永不包含 Key。
