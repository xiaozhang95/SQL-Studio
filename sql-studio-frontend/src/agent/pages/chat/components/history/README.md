# 会话列表

History受控items/activeId/busy/loading/open及onSelect/onNew/onRefresh/onDelete/onRename。桌面232px侧栏和手机Drawer共用Ant Design X Conversations，新建立即落盘，空列表初始化显示等待。无前置图标，长标题省略，编辑按钮打开横向名称表单，红色删除按钮需确认；操作按钮停止冒泡，防止同时切换会话。

useSessionRename管理弹窗选中项、Form、busy/error。名称1–80字符，空白/控制字符禁止；取消不提交，失败保留输入，成功关闭，父hook更新列表和顶栏标题。初始化失败可保留空态与错误，不能伪装创建成功；恢复不重放SQL。

selecting表示当前会话内容加载中：暂停新建、删除和重命名，但允许继续选择其他会话；busy用于模型执行、初始化与管理操作，禁止选择。列表loading仅表示轻量索引刷新，不代替会话内容加载。

历史侧栏与会话主区域统一使用colorBgContainer，亮暗主题均保持相同底色；边框、列表悬停和选中状态继续使用原生主题。
