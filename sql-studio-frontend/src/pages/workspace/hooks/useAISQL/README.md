# SQL AI 生命周期

useAISQL(scope,objects,blocked) 在实际请求时按当前连接与当前库缓存构造最多 12 表结构，优先当前表与 SQL 已引用表。上下文使用 buildAIContext 单次扫描 SQL、线性选表，不在输入渲染时排序整库或序列化结构；未配置/关闭 AI 不整理结构。返回 onEditorReady、配置状态、续写 extensions/completionLoading、优化弹窗及 optimize/close/apply。

optimize(false) 优化整页，optimize(true,selectedSQL?) 仅优化选区，空选区绝不回退整页。右键可传捕获文本，调用前必须仍匹配当前选区。结果捕获原文档身份和范围，应用时再校验，支持撤销，不自动执行SQL。

配置来自后端 AIConfig，续写开关跨页面保存；配置事件刷新并重建扩展，取消旧模型请求。仅请求中在编辑器右下角悬浮loading图标，结束后隐藏；建议直接以光标后的灰色文字展示，无建议则无任何状态文案。QueryEditor 按页面重挂载，卸载或范围变化清理取消在途请求及旧预览；无跨页面缓存。

续写额外携带当前查询scope.table、库表及字段缓存备注，document提供当前草稿开头最多16000字符（保留SQL注释），prefix/suffix继续提供光标前后上下文。连接名称和引擎由后端按connectionId解析，不使用对象树高亮推断连接。

续写扩展只在范围、库表/结构缓存、配置修订、开关或运行锁变化时重建；普通输入与无关树状态不会重建。650ms 防抖、内容长度限制、旧响应校验仍由 aiCompletion 管理；输入法正在组词时不发送请求。

第四参数 databaseType? 用于选取引擎的引用识别能力；当前 schema 同时进入续写/优化上下文与依赖。优化按真实引用完整表身份筛选，不再以 SQL 字符串包含完整引号表名判断 PostgreSQL 表引用。

编辑器现仅按页面重挂载；连接、库、schema、表或引擎变化时，取消优化请求并隐藏旧范围预览，apply再次核对请求范围，避免将旧连接优化应用到新范围。补全扩展仍随实际范围重配。

configured 仅在 Key 已保存、服务商有效且 model 非空时为 true。changeCompletion(value) 先读最新 revision，再只提交 provider/completionEnabled，避免重置已选模型或密钥；成功广播共享事件并重建扩展。preferenceSaving 互斥并发保存，preferenceError/clearPreferenceError 提供独立设置错误，卸载取消在途请求。
