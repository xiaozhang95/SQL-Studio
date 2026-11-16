# Redis 命令行输入

`ConsoleInput` 使用单行 CodeMirror，输入和候选字体继承终端所在界面的系统默认字体。受控 `value` 保存于终端会话，`initialSelection: TerminalSelection` 在创建编辑器时恢复原光标/选区，再交还输入焦点；`themeMode` 跟随工作区主题，`disabled` 在执行时禁止编辑。`onChange` 回传真实输入；`onSelectionChange` 在文本或选区变化时回传 `{anchor,head}`，供父级随草稿保存；`onViewChange` 提供编辑器以恢复焦点，卸载回传 null。

复用 Redis 的 `redisCompletion` 命令名与参数说明，以及工作区的 `useSQLCompletionPopup` / `SQLCompletionSelect`，输入命令前缀即显示本地 Select 候选，不请求 AI。上下键选择候选，Enter/Tab 接受，Escape 关闭；无候选时 Enter 调用 `onExecute`，上下键通过 `onRecall(-1 | 1)` 检索历史，Ctrl/Command+L 调用 `onClear` 清屏。候选待加载或刚出现时 Enter 不执行命令。鼠标选择保留输入焦点。

粘贴时移除换行，输入最多 `terminalCommandLimit` 个字符。载入历史、执行后清空或外部替换草稿时关闭旧候选并将光标置于末尾，不自动执行。输入中的回执、请求取消及持久化由父级终端负责。
