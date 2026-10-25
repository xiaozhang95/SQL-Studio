# 当前查询的 SQL 补全

[源码](index.ts)

参数 scope、connections、objects、columns，返回 CodeMirror extensions 数组。scope 提供显式 connectionId/database/table；仅按该连接快照组织库→表→字段，不使用树高亮或其他连接的缓存。

已缓存结构优先，当前选中表可回退 columns；未连接时 schema 为空。范围及缓存变化通过 useMemo 更新扩展，方言和扩展构造交给 getDatabaseAdapter(...).completion。

不发起请求或维护额外缓存，因此没有独立取消请求；元数据加载/取消仍归 useDatabaseObjects。QueryEditor 只调用本 hook 并传入编辑器。
