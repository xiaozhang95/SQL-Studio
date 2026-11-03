# AI 配置弹窗

AISettings({themeMode,trigger?,showCompletionSetting?}) 顶部按钮按profile展示DeepSeek文字及官方图标；弹窗标题为“DeepSeek 配置”，移除服务商选择，采用label与控件左右排列的水平表单，展示官方动态模型、API Key及代码补全开关。模型加载错误显式展示且可重试，不假装静态选项来自官方 API；Key 修改后自动获取模型，成功后允许保存。再次打开用已保存 Key 自动获取模型。留空 Key 保留旧值，成功保存后广播配置更新，代码补全开关在SQL工作区跨页面生效。表单生命周期由 useAISettings 管理。

表单顺序为API Key、模型、代码补全，Key位于模型列表之前；新Key填写后停顿自动获取列表，模型行按钮可手动重试。

表单不展示模型来源、Key留空规则与续写快捷键的常驻说明，保留字段label、占位符及实际错误提示。

页脚右侧依次为取消、移除配置、保存（移除仅已配置Key时可用）；移除期间禁用表单及关闭操作，移除后允许重新配置。

模型选择器提供请选择模型的placeholder；Key保留按是否已配置区分的现有占位符。

模型获取失败使用模型 Form.Item 的 help/validateStatus，在右侧选择框下方展示原生校验说明，与输入控件左边缘对齐，不另插入占满整行的 Alert。长错误可换行，控件列使用 flex:1 1 0/minWidth:0，避免撑开横向表单；全局配置读取或保存错误继续显示顶部 Alert。

公共组件供workspace和Agent复用同一弹窗与配置接口。可选trigger(show)替换默认顶部按钮；Agent将show交给底部模型菜单。每次打开重新读取/state/ai，所有保存/移除均操作同一ai分区，不维护Agent专用Key。

showCompletionSetting默认为true，SQL工作区展示代码补全开关；Agent传false隐藏此项，因为聊天输入不提供SQL代码补全。隐藏只改变表单展示，保留读取到的completionEnabled并随保存原样提交，不重置工作区的补全设置。
