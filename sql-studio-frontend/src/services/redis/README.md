# Redis 服务

`scanKeys`、`getKey`、`runCommand` 和 `getChannels` 按保存连接 ID 发起请求，所有读取支持取消。键使用服务端返回的原样引用。命令结果携带执行完成后的逻辑库。 `subscribe` 校验 NDJSON 订阅事件并按顺序回调 ready 与 message，可通过 AbortSignal 停止，不保存消息。
