# useChat

useChat(workspace)拥有消息Form、SSE事件、当前会话、历史Drawer和取消。启动按Go布局恢复activeId与草稿，读取历史不调用模型/数据库。send首条按需创建本地会话，流事件经applyEvent生成思考、回答与工具记录；失败保留片段。新对话只切换到空对话，不删除旧记录。历史按需读取索引、选择时加载完整事件。

草稿通过onDraftChange交给workspace保存；展开状态与主题由workspace持有。deleteHistory调用删除API，删除当前会话时清空消息、草稿、展开键与activeId；删除其他会话保留当前内容。执行、加载或删除期间禁止历史切换/新建/删除与重复发送。卸载取消请求。读取失败显示错误，不自动覆盖磁盘。

左侧列表在布局加载后读取，并在每轮结束刷新；refreshHistory显式刷新，historyLoading控制反馈。桌面常驻列表，窄屏通过historyOpen管理左抽屉。
