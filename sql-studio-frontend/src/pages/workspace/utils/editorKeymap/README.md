# 编辑器 Tab 键位

`editorTabKeymap` 是 SQL 与 Redis 多行编辑器共用的 CodeMirror 扩展。编辑器关闭 UIW 自带的 `indentWithTab`，使用 CodeMirror 的 `insertTab` 在空选区的光标处插入制表符。有选区时缩进所选行，Shift+Tab 取消缩进。

键位使用默认优先级，AI 续写启用时由其高优先级键位先处理补全。扩展遵守 CodeMirror 的只读状态和 Tab 焦点模式。
