# 加密执行历史

[源码](index.ts)

参数 connectionId 为当前 SQL 页面连接，结果页传空值。返回当前连接 history、appendHistory(item)、clearHistory(id)、ready/saving/error。每连接最多 50 条，SQL 页只显示当前连接记录；迟到执行仍按发起时 item.connectionId 写入。

追加、恢复和迁移记录时通过 stripHistoryMarkers 移除独立的 `-- 历史记录` 展示注释，不将其反复保存到历史 SQL。字符串、标识符及普通注释中的相同文字保留；重复执行仍分别记录当次状态、耗时和时间。

历史整体存入 encryptedStorage 的 history 记录，内容经 AES-GCM 加密后写 IndexedDB。首次仅在没有加密记录时合并旧 sqldesk.history / sqldesk.history.<id>，按连接去重、排序并保留最近 50 条；加密提交成功后才移除旧明文。页面恢复完成前不允许执行，避免旧记录尚未载入就被覆盖。

清空仅更新指定连接为空数组；失败/取消仍记录实际发起的语句，不记录未发送的后续 SQL。损坏或解密失败保留原数据，禁用本次会话的持久化并显示错误，不降级为明文。组件卸载丢弃展示回调，同名加密提交仍按序完成。
