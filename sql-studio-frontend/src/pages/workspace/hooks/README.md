# 工作区 hooks

- [useWorkspace](useWorkspace/README.md)：业务编排与标签范围。
- [useWorkspacePersistence](useWorkspacePersistence/README.md)：本地加密保存与恢复。
- [useQueryHistory](useQueryHistory/README.md)：只读取当前页面连接的历史，按连接分别保存。
- [useDatabaseObjects](useDatabaseObjects/README.md)：按连接隔离的元数据缓存、打开/关闭与取消。
- [useConnectionForm](useConnectionForm/README.md)：连接表单、测试与保存。
- [useConnectionGroups](useConnectionGroups/README.md)：共享分组列表的新建、重命名与连接移动。
- [useSidebarResize](useSidebarResize/README.md)：对象栏拖动、键盘调整与宽度边界。
- [useSQLCompletion](useSQLCompletion/README.md)：当前连接元数据组织与数据库补全扩展。

每个 hook 使用独立入口及文档；组件只消费其公开返回值。

- [结果表格尺寸](useTableViewportLayout/README.md)：分配表头/表体高度，保证双向滚动条不被分页遮挡。

- [导入 SQL](useSQLImport/README.md)：本地读取文件并创建独立查询，不自动执行。

- [useObjectManagement](useObjectManagement/README.md)：库表可视化表单、显式写入、取消和刷新。

- [useTableDesigner](useTableDesigner/README.md)：独立表设计页草稿、提交、重载及状态回报。

- [useDataEditing](useDataEditing/README.md)：表数据单元格显式保存、主键和原值冲突校验。

- [useAISettings](useAISettings/README.md)：读取与保存 AI 配置。

- [useAISQL](useAISQL/README.md)：AI 续写扩展、优化请求和应用。

- [对象树虚拟视口](useTreeViewport/README.md)：实际高度、滚动恢复及延迟保存。

- [useDataExport](useDataExport/README.md)：数据库、Schema、表的结构/数据转储与独立取消。

- [useWorkspaceEditor](useWorkspaceEditor/README.md)：当前编辑实例、延迟草稿同步和光标/滚动批量提交。

- [useResultTableScroll](useResultTableScroll/README.md)：新增、保存及虚拟行测量后的定位。
- [useSQLCompletionPopup](useSQLCompletionPopup/README.md)：原生补全状态与 Ant Design 候选同步。
- [useDesktopLifecycle](useDesktopLifecycle/README.md)：Electron 退出前同步草稿并等待本机保存。
