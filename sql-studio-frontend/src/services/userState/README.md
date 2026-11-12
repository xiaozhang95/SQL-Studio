# 用户配置服务

readState<T>(section,defaults) 读取 Go 的版本化分区，分区缺失才调用默认值工厂；后端失败不回落浏览器。返回配置 data，拒绝未知版本或无效修订。读取按分区去重，缓存最近成功文档；不自动迁移旧存储。

writeState(section,value) 返回 Promise<void>，使用最近读取的 revision 串行保存同一分区，响应成功才更新本地修订和缓存。未先读取拒绝写入；冲突不重试覆盖，调用者提示刷新。错误交由调用方展示，状态只归属本浏览器会话。

writeSerializedState(section,data) 仅供可信内部序列化器调用，直接组装修订信封，避免 JSON parse/stringify 往返；仍使用同一串行队列及 CAS，不重试覆盖冲突。writeState 在调用时捕获 JSON，调用方使用当前接口与保存语义。

409 使用明确的配置冲突说明；工作台提供恢复入口导出未保存草稿及历史，再由用户重新载入，不在失败后自动推进 revision 或覆盖其他窗口。
