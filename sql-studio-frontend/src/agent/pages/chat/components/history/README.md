# 会话列表

History受控items/activeId/busy/loading/open及选择、新建、刷新、删除回调。桌面232px侧栏和手机Drawer共用Ant Design X Conversations，主题色新建按钮、无前置图标、红色删除按钮与长标题省略。删除需要Popconfirm确认，按钮停止冒泡防止同时切换；加载/执行/删除期间禁用。切换只读取事件，不重放SQL。
