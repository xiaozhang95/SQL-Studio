# 聊天页面

侧栏SystemSettings与聊天输入框共用bottomInset=token.padding（默认16px），两边底部留白一致。设置按钮保持原有高度，输入框仍按自身拖拽逻辑伸缩。

ChatPage组合X会话列表、Bubble回复、Think过程、结果表和Sender输入。workspace提供本地记录状态；dark/themePreference/onThemeChange沿用SQL Studio全局外观，onBack返回工作区。右上显示共用SaveStatus与主题，保存状态取自workspace.saving/error，侧栏无底部说明；窄屏只显示保存状态图标，保留Tooltip和可访问名称。Key入口在底部模型菜单。布局、会话加载和模型设置错误显示在标题栏下方；对话流式失败与查询错误显示在消息流末尾，随当前聊天内容滚动；弹窗校验和保存错误仍留在各自弹窗。所有状态/请求归hooks，页面只组合；Transcript按activeId重建滚动状态。

- [hooks](hooks/README.md)
- [components](components/README.md)
- [constant](constant/README.md)

会话标题位于顶栏中央。消息滚动视口覆盖整个会话区，两侧空白均响应滚轮和触摸滚动；每轮正文与固定输入区复用CHAT.content，按conversationMaxWidth（960px）居中并保留两侧transcriptInset（32px）间距。导航位于独立边栏，不挤入正文。

顶栏左侧提供「新建会话」主按钮，与工作区「新建连接」使用相同样式。会话加载或执行期间禁用新建操作。

会话标题仅在至少1280px的桌面窗口居中展示；中窄窗口隐藏重复标题，避免与保存状态/主题或返回按钮重叠。760px及以下保存状态仅显示图标，保留aria-label与Tooltip；会话名称仍在历史列表或历史抽屉内可读。

完全访问模式的逐次写入确认通过WriteConfirmation卡片显示在当前回复下方，提供目标明细、完整SQL、确认/取消及错误反馈，不打开执行确认弹窗；模式切换确认仍沿用原有流程。

历史切换立即显示目标标题与加载占位，失败显示重试；切换时卸载旧Transcript并释放其消息内容和轮次切换状态。只有加载成功才挂载目标消息区，加载/失败时禁止提交问题，其他历史项仍可选择。

桌面历史侧栏和窄屏历史抽屉的列表上方均可按会话标题即时搜索。

会话初始加载和会话内轮次切换复用居中的ContentLoading，无遮罩。每次只展示一轮提问、回复和结果；点击右侧上一轮、下一轮或左侧问题导航切换，输入框固定，轮次切换不重新请求会话。

左下角历史侧栏及窄屏Drawer提供统一systemSettings入口，集中API Key/全局SQL补全与外观配置；顶部不再展示主题选择，输入框模型菜单仅切换模型，不再提供API配置入口。
在历史侧栏或窄屏历史抽屉底部打开「系统设置」，选择「工作区」即可返回。会话执行、管理或初始化期间禁用切换项。

顶栏标题偏移由sidebar.visibleWidth/2传给PageHeader，拖动侧栏和窗口限宽时同步。Agent消息与内部结果滚动条统一继承全局8px规则，不再单独缩细、改色、改弧度或隐藏主滚动条。
底部输入区预留与消息滚动视口相同的stable scrollbar gutter，避免主滚动条恢复显示后正文与输入框水平偏移。
