# 工作区 hooks

- [useWorkspace](useWorkspace/README.md)：业务编排与标签范围。
- [useWorkspacePersistence](useWorkspacePersistence/README.md)：本地加密保存与恢复。
- [useQueryHistory](useQueryHistory/README.md)：只读取当前页面连接的历史，按连接分别保存。
- [useDatabaseObjects](useDatabaseObjects/README.md)：按连接隔离的元数据缓存、打开/关闭与取消。
- [useConnectionForm](useConnectionForm/README.md)：连接表单、测试与保存。
- [useSidebarResize](useSidebarResize/README.md)：对象栏拖动、键盘调整与宽度边界。

每个 hook 使用独立入口及文档；组件只消费其公开返回值。

- [结果表格尺寸](useTableViewportLayout/README.md)：分配表头/表体高度，保证双向滚动条不被分页遮挡。

- [导入 SQL](useSQLImport/README.md)：本地读取文件并创建独立查询，不自动执行。
