# 会话列表

History受控items/activeId/busy/loading/open及onSelect/onNew/onRefresh/onDelete/onRename。桌面232px侧栏和手机Drawer共用Ant Design X Conversations，新建立即落盘，空列表初始化显示等待。无前置图标，长标题省略，编辑按钮打开横向名称表单，红色删除按钮需确认；操作按钮停止冒泡，防止同时切换会话。

useSessionRename管理弹窗选中项、Form、busy/error。名称1–80字符，空白/控制字符禁止；取消不提交，失败保留输入，成功关闭，父hook更新列表和顶栏标题。初始化失败可保留空态与错误，不能伪装创建成功；恢复不重放SQL。
