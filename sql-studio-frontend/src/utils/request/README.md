# HTTP 请求

[源码](index.ts)

request<T> 解析 JSON，非 2xx 抛出后端 error；AbortSignal 沿用调用者传入值，不吞取消。此工具不保存密码。

响应无法解析为 JSON 时提示检查 Go 服务是否已启动，默认后端端口为 18080。

导入使用 `@/utils/request`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

HTTP非成功响应抛出RequestError(message,status)，保留原消息并提供状态码；网络/取消仍原样抛出，工作区据404提示刷新，不用字符串匹配判断丢失内容。
