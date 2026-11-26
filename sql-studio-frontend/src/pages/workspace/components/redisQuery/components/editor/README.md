# Redis 命令编辑器

复用工作区 CodeMirror 样式、草稿和编辑状态。工具栏运行与 Ctrl/Command+Enter 优先执行选区，无选区时执行全文。Tab 复用 [editorKeymap](../../../../utils/editorKeymap/README.md)，在光标处插入制表符或缩进所选行。每行一条 Redis 命令，本地补全展示命令名和参数说明，复用 [useSQLCompletionPopup](../../../../hooks/useSQLCompletionPopup/README.md) 与 [SQLCompletionSelect](../../../sqlCompletionSelect/README.md)，与 SQL 编辑器及 Redis 命令行使用同一 Ant Design Select 候选展示。弹层继承当前编辑区的字体、字号、字重和行高，不展示原生 CodeMirror 候选列表；补全来源、键盘筛选和插入仍由 CodeMirror 管理。

命令用法自动显示在光标所在行的下一行，由 CodeMirror 装饰渲染并继承编辑区字体，保存、导出和执行时只读取真实输入内容。不接入 AI 续写，本地候选和命令用法始终可用；Redis 工具栏隐藏代码补全与优化按钮。点击编辑区或语法提示可恢复输入焦点。回执使用工作区共享的消息、摘要及结果表。支持 SQL 文件导入导出和历史载入。卸载时释放编辑器回调与候选测量，其他页面状态不受影响。
