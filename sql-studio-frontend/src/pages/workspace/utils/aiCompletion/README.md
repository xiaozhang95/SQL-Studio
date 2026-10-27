# AI 灰色续写扩展

aiCompletion({complete,loading}) 返回 CodeMirror 扩展。complete(prefix,suffix,document,signal) 返回建议文本；loading(boolean) 仅表示请求进行中。真实输入停顿650ms触发；Alt+反斜线手动触发。最多发送光标前10000/后4000字符，无选区且编辑器聚焦时请求，不限制SQL关键词大小写。

灰色装饰直接显示在光标后，不进入草稿，Tab接受、Esc清除。无建议或失败不展示状态文案。文档/实际选区/焦点改变和销毁取消旧请求；重复设置相同选区不会取消建议或防抖计时。旧响应不得更新装饰或loading；当前请求结束、取消及销毁均清除loading。恢复草稿不触发续写，接受建议支持撤销，Tab优先处理本地补全列表。

complete(prefix,suffix,document,signal) 同时提供文档开头最多16000字符，保留开头注释意图；光标前10000/后4000字符仍独立保留，长草稿不会失去光标附近注释。

防抖回调在发起时再次校验请求代；输入法组词期间跳过，避免未提交文字触发模型。
