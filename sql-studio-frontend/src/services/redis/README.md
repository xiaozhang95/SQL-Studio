# Redis 服务

`scanKeys`、`getKey`、`runCommand` 和 `getChannels` 按保存连接 ID 发起请求，所有读取支持取消。键使用服务端返回的原样引用。命令结果携带执行完成后的逻辑库。 `subscribe` 校验 NDJSON 订阅事件并按顺序回调 ready 与 message，可通过 AbortSignal 停止，不保存消息。

`changeKey` 的 value 操作携带可选 valueType（缺省 string）、value、before 和可选 target/ttl，直接编辑按真实 detail.type 提交。List/Set 使用 JSON 字符串数组，Hash/ZSet 使用二元字符串数组；before 为读取时原始 preview。只改键名使用 rename，值和名称同时变更时一次提交 value/target。只改过期时间使用 ttl；rename/value 可同时携带 ttl，以整数秒设置，0 表示永久，省略则保留当前期限。请求不自动重试，失败交给详情区保留草稿并显示错误。
