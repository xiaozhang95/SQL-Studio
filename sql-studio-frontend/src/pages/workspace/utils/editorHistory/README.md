# 页面撤销历史

`createEditorHistory()` 创建工作区会话内的撤销/重做缓存，返回 `save(id,state)`、`restore(id)` 和 `discard(ids)`。save 仅保留 CodeMirror 不可变 historyField 值，不保留 EditorState、EditorView、完整文档或旧主题/补全配置；restore 返回供新编辑器初始化的 Extension[]，无缓存时为空数组。

页面切换前保存，QueryEditor 挂载时将 restore 的扩展与当前主题、引擎补全组合。关闭页面时 discard 删除对应记录；同名新页面使用新 ID，不继承旧记录。仅会话内保留编辑变化所需的历史内容，不落盘、不保证浏览器刷新后撤销，也不自动执行 SQL。无网络、异步任务或跨工作区共享状态。
