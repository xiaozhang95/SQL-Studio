# AI 配置契约

AIProvider/AIProviderType 表示已实现供应商，maxAIConfigurations=64。AIConfiguration 定义 id/provider/model/modelName/configured，modelName 为发现接口的显示名称，model 为实际调用 ID，不互相推断或替换。AISettingsEntry 仅在本次草稿中增加 apiKey、模型发现结果及状态。

AIConfig 含 configurations、activeId、completionEnabled。AIConfigDocument 为修订与 data，分区缺失时 data=null。activeId 指向系统设置与 AI 助手共享的默认模型记录。公开配置类型不包含 Key。

AIAdapter 含只读 profile、listModels(apiKey,signal,configId?)、assist；profile.defaultModel 元信息不用于自动选择。空 Key 必须提供对应 configId，未知 ID 不复用别条记录。

aiModelsSection='ai-models' 是前端唯一模型存储分区常量，与后端 model.AIModelsSection 对齐。新分区不存在时从空列表开始，不受旧配置文件影响。
