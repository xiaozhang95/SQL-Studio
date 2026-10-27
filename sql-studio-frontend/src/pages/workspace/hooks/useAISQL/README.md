# SQL AI 生命周期

useAISQL(scope,objects,blocked) 按当前连接与当前库缓存构造最多12表结构，优先SQL已引用表。返回 onEditorReady、配置状态、续写 extensions/completionLoading、优化弹窗及 optimize/close/apply。

optimize(false) 优化整页，optimize(true,selectedSQL?) 仅优化选区，空选区绝不回退整页。右键可传捕获文本，调用前必须仍匹配当前选区。结果捕获原文档身份和范围，应用时再校验，支持撤销，不自动执行SQL。

配置来自后端 AIConfig，续写开关跨页面保存；配置事件刷新并重建扩展，取消旧模型请求。仅请求中在编辑器右下角悬浮loading图标，结束后隐藏；建议直接以光标后的灰色文字展示，无建议则无任何状态文案。QueryEditor 按页面/连接/库/运行状态重挂载，卸载清理取消在途请求及旧预览；无跨页面缓存。

续写额外携带当前查询scope.table、库表及字段缓存备注，document提供当前草稿开头最多16000字符（保留SQL注释），prefix/suffix继续提供光标前后上下文。连接名称和引擎由后端按connectionId解析，不使用对象树高亮推断连接。
