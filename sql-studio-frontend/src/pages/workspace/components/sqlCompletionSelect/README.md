# SQL 语法补全下拉

`completion: ReturnType<typeof useSQLCompletionPopup>` 提供候选、当前项及光标位置；`objectKinds: ReadonlyMap<string, SQLCompletionObjectKind>` 提供当前连接的对象类型。使用真实 Ant Design Select 的主题、虚拟选项和弹层翻转，最大宽度 360px、高度 256px，弹层挂载 body 避免编辑器裁切。

隐藏 Select 仅作定位锚点，输入焦点属于 CodeMirror；候选区阻止 mousedown 抢走焦点，点击调用原生补全命令。原生键盘选中项同步到 Select 并滚入可见区；选项保留字符串无障碍标签，字段/表/关键词来源仍由数据库 adapter 提供。

弹层与选项沿用 Ant Design 默认排版，详情使用原生次级文字色。左侧复用 Ant Design 图标区分关键字、函数、数据类型、数据库、Schema、表、视图、字段及其他候选；图标不参与候选值或文本插入，不用 emoji 或名称猜测对象类型。
