# 键详情编辑草稿

`useKeyEditor(key,detail,ttlMillis,onSave,clearError)` 管理键名、完整值及待设置 TTL，返回 name/value/ttl、remainingSeconds、maximumTTL、ttlInvalid、dirty、changeName/changeValue/changeTTL、cancel 和异步 save。草稿只在当前详情存活，不持久化；切换键、重新读取或卸载后丢弃。

键详情读取后 TTL 输入显示初始剩余秒数，取消和重新载入恢复为该值，不随倒计时刷新。remainingSeconds 独立从父级每秒读取的 ttlMillis 换算，负值表示永久有效。倒计时不覆盖输入，也不改变 dirty。接受 0–315360000 的整数秒，编辑后空值或越界时禁用保存。

只有用户明确编辑 TTL 才提交期限，默认显示 0 不会移除当前过期时间。仅修改 TTL 时提交 ttl；仅改名提交 rename；改值提交 value、实际 valueType、原始 before 及可选新键名。rename/value 可同时携带已编辑的 TTL，未编辑时省略以保留原期限。不能编辑的值仍可单独改名或设置 TTL。取消恢复名称和值并清除 TTL 草稿；请求互斥、错误及刷新由 [useKeyBrowser](../useKeyBrowser/README.md) 管理，失败保留草稿。
