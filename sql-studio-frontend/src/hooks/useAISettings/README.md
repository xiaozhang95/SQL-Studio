# AI 配置状态

useAISettings() 管理配置面板的 open/ready/loading/saving/removing/busy/error/configured、provider/model/apiKey、模型列表与请求状态；公开 show/close/save/remove/changeKey/refreshModels/setModel。服务商当前固定为已注册的 DeepSeek。

show 每次读取 /api/state/ai，读取已保存配置后才允许保存；已配置 Key 时用空 Key 调用服务商模型发现，由后端复用密钥。模型请求有独立 AbortController，换 Key、关闭或卸载时取消，通过面板代次和 signal 丢弃迟到响应。Key 仅存在本次输入，不进入工作区或浏览器存储。

输入 Key 停顿 500ms 自动获取列表，手动 refreshModels 可取消防抖并重试。模型必须来自成功加载的实际列表；优先恢复已选模型，其次默认模型，否则选择首项。空列表与协议错误由模型服务校验。

save 成功返回 true、清理输入并广播 ai-settings-saved；失败返回 false 并保留表单和错误，未就绪或忙碌时也返回 false。提交只含 provider/model/apiKey 及 revision，不发送地址，不改写原 completionEnabled。空 Key 由后端保留，revision 防止覆盖其他页面的修改。

remove 通过 DELETE /api/ai/config 及当前 revision 清除配置，成功返回 true 并广播更新，补全和美化入口同步隐藏；失败返回 false 并保留错误。保存/移除互斥，卸载取消模型请求，不自动重试覆盖冲突。
