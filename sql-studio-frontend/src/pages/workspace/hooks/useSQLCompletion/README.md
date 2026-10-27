# 当前查询的 SQL 补全

[源码](index.ts)

参数 scope、connections、objects、columns，返回 CodeMirror extensions 数组。scope 提供显式 connectionId/database/table；仅按该连接快照组织库→表→字段，不使用树高亮或其他连接的缓存。

已缓存结构优先，当前选中表可回退 columns；未连接时 schema 为空。useMemo 仅依赖当前连接状态、库表及结构缓存、范围和字段；输入、滚动、树加载状态/索引缓存变化不重建扩展。方言和扩展构造交给 getDatabaseAdapter(...).completion。

不发起请求或维护额外缓存，因此没有独立取消请求；元数据加载/取消仍归 useDatabaseObjects。QueryEditor 只调用本 hook 并传入编辑器。

把 QueryScope.schema 映射为 SQLCompletionContext.namespace，并作为 memo 依赖；选择另一个 schema 后重建当前页补全。
