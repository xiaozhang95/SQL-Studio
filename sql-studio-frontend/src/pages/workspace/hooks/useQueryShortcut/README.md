# SQL 编辑器执行快捷键

useQueryShortcut({enabled,editor,run}) 仅在可见工作台的查询编辑器内部捕获 Ctrl/Command+Enter，先于 CodeMirror 插入空行处理；不修改草稿。enabled 由工作台活动状态、内容就绪和界面锁共同决定。其他控件、AI 助手、可见模态框、输入法组合及 Alt/Shift 组合不触发。回调通过 ref 保持最新，卸载移除监听。
