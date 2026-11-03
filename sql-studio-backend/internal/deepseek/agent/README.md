# DeepSeek客户端

New(Credentials)消费本包声明的动态凭据接口。Generate(ctx,messages,tools)用于非思考摘要请求（2400输出token、60秒、512KiB响应）；GenerateStream(ctx,messages,tools,emit)用于正式聊天，thinking enabled、reasoning_effort low、stream true、16384输出token、单次150秒，继承整个聊天180秒限制。

解析官方SSE reasoning_content/content/工具参数片段/usage，最多4个工具；工具标识、finish_reason、结束标志完整后才返回可执行工具。总响应限2MiB，单SSE行256KiB；异常/取消不接受未完成工具，错误不回传上游正文或Key。reasoning_content保存在model.Message并带回下一次工具请求，不把执行步骤当作思考。测试使用本地替身，无实际模型费用。
