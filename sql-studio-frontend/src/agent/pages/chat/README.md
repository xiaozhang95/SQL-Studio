# 聊天页面

ChatPage组合X会话列表、Bubble回复、Think过程、结果表和Sender输入。workspace提供本地记录状态；dark/themePreference/onThemeChange沿用SQL Studio全局外观，onBack返回工作区。右上仅主题，Key入口在底部模型菜单。所有状态/请求归hooks，页面只组合；Transcript按activeId重建滚动状态。

- [hooks](hooks/README.md)
- [components](components/README.md)
- [constant](constant/README.md)
