# 聊天页面

聊天输入框使用 token.padding（默认 16px）作为底部留白，并按自身拖拽逻辑伸缩。

ChatPage组合X会话列表、Bubble回复、Think过程、结果表和Sender输入。workspace提供本地记录状态；dark 和 AppearancePreferences 沿用 SQL Studio 全局主题、字号及恢复状态，onBack返回工作区。右上显示共用SaveStatus与系统设置面板，保存状态取自workspace.saving/error，侧栏无底部说明；窄屏只显示保存状态图标，保留Tooltip和可访问名称。Key入口在底部模型菜单。布局、会话加载和模型设置错误显示在标题栏下方；对话流式失败与查询错误显示在消息流末尾，随当前聊天内容滚动；弹窗校验和保存错误仍留在各自弹窗。所有状态/请求归hooks，页面只组合；Transcript按activeId重建滚动状态。

- [hooks](hooks/README.md)
- [components](components/README.md)
- [constant](constant/README.md)

业务顶栏保留会话标题，偏移侧栏宽度的一半使其居中于右侧内容区；Electron 最上方的 SQL Studio 应用标题隐藏。消息滚动视口覆盖整个会话区，两侧空白均响应滚轮和触摸滚动；每轮正文与固定输入区复用CHAT.content，按conversationMaxWidth（960px）居中并保留两侧transcriptInset（32px）间距。导航位于独立边栏，不挤入正文。

空会话通过 Welcome 展示引导标题和三类带功能图标的提问示例。

顶栏左侧提供「新建会话」主按钮，与工作区「新建连接」使用相同样式。会话加载或执行期间禁用新建操作。

会话标题使用 Ant Design fontSizeLG，1280px 以下隐藏，避免覆盖操作按钮；760px及以下保存状态仅显示图标，保留aria-label与Tooltip。

完全访问模式的逐次写入确认通过WriteConfirmation卡片显示在当前回复下方，提供目标明细、完整SQL、确认/取消及错误反馈，不打开执行确认弹窗；模式切换确认仍沿用原有流程。

历史切换立即显示目标标题与加载占位，失败显示重试；切换时卸载旧Transcript并释放其消息内容和轮次切换状态。只有加载成功才挂载目标消息区，加载/失败时禁止提交问题，其他历史项仍可选择。

桌面历史侧栏和窄屏历史抽屉的列表上方均可按会话标题即时搜索。

会话内可用滚轮、触摸、键盘和导航按钮连续浏览，虚拟窗口最多挂载 5 轮。到窗口中段时预挂载相邻轮次，快速滑到未挂载区域时显示至少 1 秒的加载提示。输入框固定，轮次浏览使用已读取的会话。

右上角「系统设置」下拉菜单集中提供 API Key、全局 SQL 补全和外观配置。输入框的模型菜单用于切换模型。
顶栏左侧的新建会话按钮组后，以竖线分隔「工作区」入口按钮。点击即可返回工作区。会话执行、管理或初始化期间禁用返回入口。

PageHeader 保留原有 56px 业务高度及上下内边距，仅将 macOS 系统按钮所在的 Electron 标题栏收紧到 24px。Agent消息与内部结果滚动条统一继承全局8px规则，不再单独缩细、改色、改弧度或隐藏主滚动条。
底部输入区预留与消息滚动视口相同的stable scrollbar gutter，避免主滚动条恢复显示后正文与输入框水平偏移。
