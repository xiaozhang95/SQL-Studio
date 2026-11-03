# 聊天页面

ChatPage组合X会话列表、Bubble回复、Think过程、结果表和Sender输入。workspace提供本地记录状态；dark/themePreference/onThemeChange沿用SQL Studio全局外观，onBack返回工作区。右上显示共用SaveStatus与主题，保存状态取自workspace.saving/error，侧栏无底部说明；窄屏只显示保存状态图标，保留Tooltip和可访问名称。Key入口在底部模型菜单。布局、会话加载和模型设置错误显示在标题栏下方；对话流式失败与查询错误显示在消息流末尾，随当前聊天内容滚动；弹窗校验和保存错误仍留在各自弹窗。所有状态/请求归hooks，页面只组合；Transcript按activeId重建滚动状态。

- [hooks](hooks/README.md)
- [components](components/README.md)
- [constant](constant/README.md)

会话标题位于顶栏中央。消息滚动视口覆盖整个会话区，两侧空白均响应滚轮和触摸滚动；每轮正文与固定输入区复用CHAT.content，按conversationMaxWidth（960px）居中并保留两侧transcriptInset（32px）间距。导航位于独立边栏，不挤入正文。

完全访问模式的逐次写入确认通过WriteConfirmation卡片显示在当前回复下方，提供目标明细、完整SQL、确认/取消及错误反馈，不打开执行确认弹窗；模式切换确认仍沿用原有流程。
