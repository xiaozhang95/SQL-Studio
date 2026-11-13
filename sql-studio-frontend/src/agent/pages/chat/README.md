# 聊天页面

聊天输入框使用 token.padding（默认 16px）作为底部留白，并按自身拖拽逻辑伸缩。

ChatPage 组合会话列表、回复、思考过程、结果表和输入框。workspace 提供本地记录状态，dark 和 AppearancePreferences 沿用全局主题、字号和外观保存状态，onBack 返回工作区。系统设置入口位于顶栏右侧，保存期间在入口前显示 SaveStatus。布局、模型、外观和会话管理错误通过 PageHeader 在顶栏下方合并展示。会话内容加载、流式回复和弹窗错误均使用共享 ErrorNotice，展示于所属内容区域。所有请求和状态由 hooks 管理，Transcript 按 activeId 重建滚动状态。

- [hooks](hooks/README.md)
- [components](components/README.md)
- [constant](constant/README.md)

业务顶栏保留会话标题，偏移侧栏宽度的一半使其居中于右侧内容区；Electron 最上方的 SQL Studio 应用标题隐藏。消息滚动视口覆盖整个会话区，两侧空白均响应滚轮和触摸滚动；每轮正文与固定输入区复用CHAT.content，按conversationMaxWidth（960px）居中并保留两侧transcriptInset（32px）间距。导航位于独立边栏，不挤入正文。

空会话通过 Welcome 展示引导标题和三类带功能图标的提问示例。

顶栏左侧提供「新建会话」主按钮，与工作区「新建连接」使用相同样式。会话加载或执行期间禁用新建操作。

会话标题使用 Ant Design fontSizeLG，由 PageHeader 测量两侧操作区间距并限制可用宽度；各窗口宽度下保存状态都仅在保存时显示 loading 图标，保留 aria-label 与 Tooltip。

完全访问模式的逐次写入确认通过WriteConfirmation卡片显示在当前回复下方，提供目标明细、完整SQL、确认/取消及错误反馈，不打开执行确认弹窗；模式切换确认仍沿用原有流程。

历史切换立即显示目标标题与加载占位，失败显示重试；切换时卸载旧Transcript并释放其消息内容和轮次切换状态。只有加载成功才挂载目标消息区，加载/失败时禁止提交问题，其他历史项仍可选择。

桌面历史侧栏和窄屏历史抽屉的列表上方均可按会话标题即时搜索。

会话内可用滚轮、触摸、键盘和导航按钮连续浏览，虚拟窗口最多挂载 5 轮。到窗口中段时预挂载相邻轮次，快速滑到未挂载区域时显示至少 1 秒的加载提示。输入框固定，轮次浏览使用已读取的会话。

右上角「系统设置」弹框集中提供模型、API Key 和外观配置，底部统一保存。输入框的模型菜单用于切换模型。
顶栏左侧的新建会话按钮组后，以竖线分隔「工作区」入口按钮。点击即可返回工作区。会话执行、管理或初始化期间禁用返回入口。

业务顶栏使用共享 PageHeader，最小高度为 `controlHeight + paddingSM`。消息与结果使用全局 6px 滚动条样式。
底部输入区预留与消息滚动视口相同的stable scrollbar gutter，避免主滚动条出现时正文与输入框水平偏移。
