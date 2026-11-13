# Agent 布局服务

workspace(method,input?,signal?,keepalive=false) 调用 /api/agent/workspace；GET 读取当前布局，PUT 提交 revision 与完整 Layout，返回 Promise<Workspace>。当前 Layout 必须包含 mode（readonly/write）、activeId、draft 和 expanded 数组，缺失字段、无效版本或类型错误均拒绝，不补旧字段。

请求通过全局 request 工具处理网络、JSON 和 HTTP 错误，409 明确告知布局冲突并停止覆盖。signal 与 keepalive 由调用者控制。首次文件缺失由后端返回完整当前默认布局。
