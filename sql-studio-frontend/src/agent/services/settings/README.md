# Agent 模型状态服务

settings(method,input?,signal?) 通过全局 request 工具调用 /api/agent/settings，GET 读取脱敏状态，PUT 提交 {configId} 选择已有记录，DELETE 清空配置，返回 Promise<AIStatus>。运行时校验 configId/model/configured/source/models，共享网络、JSON 和 HTTP 错误提示并支持取消。Key 由独立的配置接口管理。

observeSettings 订阅共享配置变化、回焦和可见事件，取消旧请求，卸载移除订阅；迟到响应不覆盖。配置字段只采用新协议，不兼容旧请求。
