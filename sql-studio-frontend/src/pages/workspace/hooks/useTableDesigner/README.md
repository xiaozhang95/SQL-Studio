# 表设计页生命周期

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

[源码](index.ts) · [hooks 索引](../README.md)

useTableDesigner 接收 TableDesignerOptions：不可变页面 ID/初始范围、连接、提交禁用状态、按 ID 的 onBusyChange/onDirtyChange、onCommitted 和异步 onChanged。组合 useObjectManagement 的 initial/keepOpen 模式，保留独立 Form、原字段、原 DDL、加载请求、错误及预览。

初次访问页面且连接可用时加载；仅切换标签不重新加载。保存先回报页面名称/kind，再刷新元数据，原页切到 EditTable 并重载，不隐式再次执行 DDL。保存前检查原 DDL 是否变化，忽略表自增计数变化，其他结构变化要求重新加载；这是提交前检测，不替代数据库权限或并发控制。关闭卸载中止只读请求，保存期间工作区禁止关闭。

reload 在草稿未保存时提示确认放弃。草稿仅保存在本次浏览器页面的存活组件内；工作区索引只恢复页签范围，刷新后重新读取元数据，不恢复未提交的设计草稿，不自动执行写入。
