# 工作区序列化缓存

createWorkspaceSerializer() 返回 (snapshot:WorkspaceSnapshot)=>string。使用 WeakMap 按不可变 tab/run/result 引用缓存 JSON，输入、滚动、分页更新不重新遍历未变化结果单元格；缓存随对象释放，无全局缓存。最终文件仍为完整工作区 JSON，不删 SQL、语句或数据行。

仅去掉 run.result 与最后一条 statements.result 指向同一结果时的重复副本。restoreWorkspaceResults(snapshot) 在读取后恢复该共享引用，兼容旧快照，保留结果来源、精确文本、NULL 和错误；不重跑 SQL。序列化仅供受信任内部快照调用，传给 writeSerializedState。
