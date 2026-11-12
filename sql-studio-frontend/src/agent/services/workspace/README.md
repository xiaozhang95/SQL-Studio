# Agent 布局服务

workspace(method,input?,signal?,keepalive=false) 调用 /api/agent/workspace；GET 读取当前布局，PUT 提交 revision 与完整 Layout，返回 Promise<Workspace>。当前 Layout 必须包含 mode（readonly/write）、activeId、draft 和 expanded 数组，缺失字段、无效版本或类型错误均拒绝，不补旧字段。

网络/HTTP错误抛出，409明确告知冲突并停止覆盖；signal与keepalive由调用者控制。首次文件缺失由后端返回完整当前默认布局，不在客户端读取其他配置或存储。
