# HTTP 请求

[源码](index.ts)

request<T> 解析 JSON，非 2xx 抛出后端 error；AbortSignal 沿用调用者传入值，不吞取消。此工具不保存密码。

导入使用 `@/utils/request`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
