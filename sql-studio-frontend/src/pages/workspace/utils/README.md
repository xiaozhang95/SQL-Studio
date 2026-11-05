# 工作区工具

- [页面标题](pageTitle/README.md)：查询页签按该页数据库/Schema 联动显示，保留原始名称。

- [执行输出兼容和耗时读取](queryOutput/README.md)

- [AI 续写扩展](aiCompletion/README.md)：灰色预览与 Tab 接受。
- [AI 表结构上下文](aiContext/README.md)：请求时线性选择当前库表。
- [执行历史规则](queryHistory/README.md)：每连接 50 条及已删除连接清理。
- [编辑器外观](editorAppearance/README.md)：CodeMirror 原生样式扩展，隔离编辑与只读预览。
- [对象树标识与索引说明](objectTree/README.md)。

- [单库请求代](databaseLifecycle/README.md)。
- [范围关闭与 SQL 汇总](scopeClose/README.md)。

- [目标范围状态更新](workspaceTransitions/README.md)。
- [纯数据对象树](explorerTree/README.md)。

[对象展示兼容](objectPresentation/README.md) 为旧结构结果和对象页标题提供不执行 SQL 的 schema 展示转换。

- [编辑内容同步缓冲](editorBuffer/README.md)：延迟全文读取、固定期限合并和切页同步。
- [页面撤销历史](editorHistory/README.md)：会话内按页面保留撤销/重做变化，关闭时释放。
- [结果分页映射](resultRows/README.md)：筛选下标缓存、可见页对象和完整CSV数据。

- [转储可用状态](exportAvailability/README.md)：连接和目标库成功打开后的统一门禁。

- [workspacePages](workspacePages/README.md)：提交前校正失效schema和标签显示，保持无变化引用稳定。
