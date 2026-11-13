# HTTP 请求

[源码](index.ts)

`request<T>(path, options?)` 请求 `/api` 下的 JSON API。`fetchResponse(path, options?)` 用于 SSE 等响应，`readJSON<T>(response, signal?)` 共享解析与 HTTP 错误处理。调用者传入不含 `/api` 前缀的路径。

网络连接失败、空响应及无效 JSON 使用相同的后端服务和代理配置提示。有效的非 2xx JSON 响应抛出 `RequestError(message, status)`，保留后端原因和状态码。204 成功响应返回 undefined。AbortSignal 沿用调用者传入值，中止原因原样抛出。

导入使用 `@/utils/request`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

工作区据 RequestError 的 404 状态提示刷新，Agent 布局据 409 暂停保存。JSON 数据结构由对应业务服务继续校验。
