# 工作区 hooks

- [useWorkspace](useWorkspace/README.md)：业务编排与标签范围。
- [useDatabaseObjects](useDatabaseObjects/README.md)：元数据缓存与取消。
- [useConnectionForm](useConnectionForm/README.md)：连接表单、测试与保存。

每个 hook 使用独立入口及文档；组件只消费其公开返回值。

- [结果表格尺寸](useResultTableLayout/README.md)：分配表头/表体高度，保证双向滚动条不被分页遮挡。

- [导入 SQL](useSQLImport/README.md)：本地读取文件并创建独立查询，不自动执行。
